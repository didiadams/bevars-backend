import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import * as crypto from 'crypto';
import { OrderRepository } from './repositories/order.repository';
import { Order, OrderStatus, OrderType } from './entities/order.entity';
import { OrderDocument, OrderDocumentType } from './entities/order-document.entity';
import { OrderDocumentRepository } from './repositories/order-document.repository';
import { OrderReviewRepository } from './repositories/review.repository';
import { OfferService } from '../offer/offer.service';
import { Offer, OfferStatus } from '../offer/entities/offer.entity';
import { ExporterService } from '../exporter/exporter.service';
import { GlobalBuyerService } from '../global-buyer/global-buyer.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    @Inject(forwardRef(() => OfferService))
    private readonly offerService: OfferService,
    @Inject(forwardRef(() => ExporterService))
    private readonly exporterService: ExporterService,
    @Inject(forwardRef(() => GlobalBuyerService))
    private readonly globalBuyerService: GlobalBuyerService,
    private readonly orderDocumentRepository: OrderDocumentRepository,
    private readonly orderReviewRepository: OrderReviewRepository,
  ) {}

  // Define required documents for each status transition (documents must be uploaded by exporter)
  private requiredDocsForStatus: Partial<Record<OrderStatus, OrderDocumentType[]>> = {
    // Step 1: Buyer must attach their signed Purchase Order before exporter can confirm
    [OrderStatus.CONFIRMED]: [OrderDocumentType.PURCHASE_ORDER],

    // Step 2: When moving into production, exporter should have uploaded proforma_invoice
    [OrderStatus.IN_PRODUCTION]: [OrderDocumentType.PROFORMA_INVOICE],

    // Step 4: Ready for shipment requires final invoice + packing list + certificate of origin
    [OrderStatus.READY_FOR_SHIPMENT]: [
      OrderDocumentType.FINAL_INVOICE,
      OrderDocumentType.PACKING_LIST,
      OrderDocumentType.CERTIFICATE_OF_ORIGIN,
    ],

    // Step 5: Shipped requires bill of lading or equivalent
    [OrderStatus.SHIPPED]: [OrderDocumentType.BILL_OF_LADING],

    // Step 6: Delivered may require a delivery note
    [OrderStatus.DELIVERED]: [OrderDocumentType.DELIVERY_NOTE],

    // Step 7: Completed requires final invoice (and buyer acceptance optional)
  // Removed FINAL_INVOICE duplication at COMPLETED (already enforced earlier at READY_FOR_SHIPMENT)
  [OrderStatus.COMPLETED]: [],

  // Cancellation now requires no documents; reason stored in notes
  [OrderStatus.CANCELLED]: [],
    [OrderStatus.DISPUTED]: [OrderDocumentType.DISPUTE_DOC],
  };

  // Central list of statuses that require explicit buyer approval (server authoritative).
  private approvalRequiredStatuses: OrderStatus[] = [
    OrderStatus.READY_FOR_SHIPMENT,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ];

  // Canonical ordered lifecycle sequence (excluding DISPUTED which is an out-of-band state)
  private readonly statusSequence: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.IN_PRODUCTION,
    OrderStatus.READY_FOR_SHIPMENT,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
    OrderStatus.DISPUTED, // included for completeness; not linear
  ];

  // Internal monotonically increasing counter to allow forced cache busts
  private metaVersionCounter = 1;

  /** Force a meta version bump (e.g. after an admin changes doc rules at runtime). */
  bumpLifecycleMetaVersion(): void {
    this.metaVersionCounter += 1;
  }

  /** Compute a stable hash for the current lifecycle meta core content. */
  private computeLifecycleHash(): string {
    const core = {
      approvalRequired: this.approvalRequiredStatuses,
      requiredDocs: this.getRequiredDocsMap(),
      statusSequence: this.statusSequence,
    };
    const json = JSON.stringify(core);
    return crypto.createHash('sha256').update(json).digest('hex').slice(0, 12); // short hash
  }

  /** Full lifecycle meta payload consumed by controller and clients. */
  getLifecycleMeta() {
    const requiredDocs = this.getRequiredDocsMap();
    const approvalRequired = this.getApprovalRequiredStatuses();
    const orderedStatuses = [...this.statusSequence];
    const previousOf: Record<string, OrderStatus | null> = {};
    for (let i = 0; i < orderedStatuses.length; i += 1) {
      const s = orderedStatuses[i];
      // Skip DISPUTED for predecessor mapping (it can come from several states)
      if (s === OrderStatus.DISPUTED) {
        previousOf[s] = null;
        continue;
      }
      previousOf[s] = i > 0 ? orderedStatuses[i - 1] : null;
    }
    // Base transition guidance (generic, excluding special dispute/approval logic nuances)
    const transitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
      [OrderStatus.IN_PRODUCTION]: [OrderStatus.READY_FOR_SHIPMENT, OrderStatus.CANCELLED],
      [OrderStatus.READY_FOR_SHIPMENT]: [OrderStatus.SHIPPED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.DISPUTED]: [...this.approvalRequiredStatuses, OrderStatus.CANCELLED, OrderStatus.CONFIRMED],
    };

    const hash = this.computeLifecycleHash();
    return {
      version: this.metaVersionCounter,
      hash,
      generatedAt: new Date().toISOString(),
      statuses: Object.values(OrderStatus), // raw enum expansion
      orderedStatuses,
      previousOf,
      approvalRequired,
      requiredDocs,
      documentTypes: Object.values(OrderDocumentType),
      transitions,
      notes: {
        disputed: 'DISPUTED is an out-of-band state; transitions depend on mediation outcomes and approval flows.',
        autoCompleteRule: 'Buyer approval of DELIVERED auto-completes the order (COMPLETED).',
      },
    };
  }

  getApprovalRequiredStatuses(): OrderStatus[] {
    return [...this.approvalRequiredStatuses];
  }

  /**
   * Runtime helper for internal logic to check if a status requires buyer approval.
   * Keeps all approval-required logic pointing at the single authoritative list.
   */
  isApprovalRequired(status: OrderStatus): boolean {
    return this.approvalRequiredStatuses.includes(status);
  }

  getStatusSequence(): OrderStatus[] { return [...this.statusSequence]; }

  /**
   * Public accessor so controllers/other services can serve a canonical
   * mapping to the frontend – avoids drift with client-side constants.
   */
  getRequiredDocsMap(): Record<string, OrderDocumentType[]> {
    // Return a shallow copy to prevent accidental mutation.
    const out: Record<string, OrderDocumentType[]> = {};
    Object.entries(this.requiredDocsForStatus).forEach(([k, v]) => {
      if (v) out[k] = [...v];
    });
    return out;
  }

  /**
   * Normalize incoming/alias document type names to enum values.
   * Centralized here so both controller & service logic can stay consistent.
   */
  normalizeDocumentType(raw: string): OrderDocumentType | string {
    if (!raw) return raw;
    const s = raw.toLowerCase().replace(/[-\s]/g, '_');
    // Common synonyms
    const aliases: Record<string, OrderDocumentType> = {
      pod: OrderDocumentType.DELIVERY_NOTE,
      proof_of_delivery: OrderDocumentType.DELIVERY_NOTE,
      commercial_invoice: OrderDocumentType.FINAL_INVOICE,
      invoice_final: OrderDocumentType.FINAL_INVOICE,
      proforma: OrderDocumentType.PROFORMA_INVOICE,
    };
    if (aliases[s]) return aliases[s];
    // Pass through if already valid
    if ((Object.values(OrderDocumentType) as string[]).includes(s)) return s as OrderDocumentType;
    return s; // let validation upstream decide
  }

  async createFromOffer(offer: Offer): Promise<Order> {
    // Verify offer is accepted
    if (offer.status !== OfferStatus.ACCEPTED) {
      throw new BadRequestException('Can only create order from accepted offers');
    }

    // Check if order already exists for this offer
    const existingOrder = await this.orderRepository.findOne({
      where: { offerId: offer.id },
    });

    if (existingOrder) {
      throw new BadRequestException('Order already exists for this offer');
    }

    const orderNumber = await this.orderRepository.generateOrderNumber();

    const order = this.orderRepository.create({
      offerId: offer.id,
      globalBuyerId: offer.sourcingRequest.globalBuyerId,
      exporterId: offer.exporterId,
      orderNumber,
      status: OrderStatus.PENDING,
      type: offer.isCounterOffer ? OrderType.NEGOTIATED_DEAL : OrderType.DIRECT_PURCHASE,
      totalAmount: offer.totalPrice,
      currency: offer.currency,
      quantity: offer.availableQuantity,
      unitPrice: offer.pricePerUnit,
      expectedDeliveryDate: offer.estimatedDeliveryDate,
      specialInstructions: offer.additionalNotes,
  // Do not set confirmedAt when creating an order in PENDING status.
  // confirmedAt should only be set when the order transitions to CONFIRMED.
    });

    return this.orderRepository.save(order);
  }

  async addDocument(orderId: string, type: OrderDocumentType, url: string, userId: string): Promise<OrderDocument> {
    // verify order exists and user is allowed to upload (exporter or buyer)
    const order = await this.findOne(orderId, userId);
    const isExporter = order.exporter?.userId === userId;
    const isBuyer = order.globalBuyer?.userId === userId;

    // Allow buyers to upload only the PURCHASE_ORDER document (their official PO)
    if (isBuyer) {
      // Buyer may upload purchase order; optionally allow cancellation notice in future.
      if (type !== OrderDocumentType.PURCHASE_ORDER) {
        throw new ForbiddenException('Buyer may only upload purchase orders');
      }
    }

    // Exporters can upload all document types
    if (!isExporter && !isBuyer) {
      throw new ForbiddenException('You do not have permission to upload documents for this order');
    }

    // If a document of this type already exists for the order, treat this as an update (patch)
    // This enables exporters to re-upload/replace documents (important during dispute flows)
    let existing = await this.orderDocumentRepository.findOne({ where: { orderId, type } });
    let saved: OrderDocument;
  if (existing) {
      // Overwrite rules:
      // - PURCHASE_ORDER may only be created/updated by the buyer (globalBuyer.userId)
      // - All other document types may only be created/updated by the exporter
      if (type === OrderDocumentType.PURCHASE_ORDER) {
        if (!isBuyer) {
          // Prevent exporter (or others) from overwriting buyer's official PO
          throw new ForbiddenException('Only the buyer may create or update the purchase order document');
        }
      } else {
        if (!isExporter) {
          // Buyers are not permitted to overwrite exporter-provided documents
          throw new ForbiddenException('Only the exporter may create or update this document type');
        }
      }

      // Update existing record
      existing.url = url;
      existing.uploadedByUserId = userId;
      // Refresh uploadedAt to indicate new upload
      try {
        (existing as any).uploadedAt = new Date();
      } catch (e) {
        // ignore if DB controls the timestamp automatically
      }
      saved = await this.orderDocumentRepository.save(existing);
    } else {
      // Creating new document: block exporters from creating the buyer's purchase order
      if (type === OrderDocumentType.PURCHASE_ORDER && !isBuyer) {
        throw new ForbiddenException('Only buyer may create the purchase order document');
      }
      const doc = this.orderDocumentRepository.create({ orderId, type, url, uploadedByUserId: userId });
      saved = await this.orderDocumentRepository.save(doc);
    }
    try {
      console.log(`[order.service] addDocument saved - id=${saved.id} orderId=${saved.orderId} type=${saved.type} url=${saved.url} uploadedBy=${saved.uploadedByUserId}`);
      // If this upload occurs while the order is disputed, record that in notes
      const order = await this.orderRepository.findOne({ where: { id: saved.orderId } });
      if (order && order.status === OrderStatus.DISPUTED) {
        // note whether this upload replaced an existing file
        const replaced = existing ? 'true' : 'false';
        order.notes = (order.notes || '') + `\n[dispute_upload] replaced=${replaced} type=${saved.type} by=${userId} url=${saved.url}`;
        // Provide a clearer, human-friendly summary for UIs
        order.notes = (order.notes || '') + `\n[dispute_message] Exporter uploaded document ${saved.type}. Please review and either withdraw the dispute or reject again if still insufficient.`;
        // If the upload completes the required documents for the order's previous status,
        // record that and set an awaitingApprovalFor marker so the buyer will be notified
        try {
          const prev = order.previousStatus as OrderStatus | undefined;
          if (prev) {
            const requiredForPrev = this.requiredDocsForStatus[prev] ?? [];
            if (requiredForPrev && requiredForPrev.length > 0) {
              const docs = await this.orderDocumentRepository.findByOrderId(order.id);
              const uploadedTypes = new Set((docs || []).map((d) => d.type));
              const missing = requiredForPrev.filter((r) => !uploadedTypes.has(r));
              if (missing.length === 0) {
                order.notes = (order.notes || '') + `\n[dispute_docs_complete] Exporter uploaded all required documents for previous status=${prev}`;
                // Mark awaiting approval for the previous status so buyer sees a request
                order.awaitingApprovalFor = prev;
                order.awaitingApprovalAt = new Date();
              }
            }
          }
        } catch (e) {
          // ignore errors in this best-effort check
        }
        await this.orderRepository.save(order);
      }
    } catch (e) {
      // ignore logging errors
    }
    return saved;
  }

  // Exporter requests buyer approval for a target status after uploading docs
  async requestApproval(orderId: string, targetStatus: OrderStatus, userId: string): Promise<Order> {
    const order = await this.findOne(orderId, userId);
    // Only exporter may request approval
    const isExporter = order.exporter?.userId === userId;
    if (!isExporter) throw new ForbiddenException('Only exporter can request approval');

    // Validate targetStatus is one that requires approval
    if (!this.isApprovalRequired(targetStatus)) {
      throw new BadRequestException('Status does not require buyer approval');
    }

    // Ensure required documents are present for that status
    const required = this.requiredDocsForStatus[targetStatus] ?? [];
    const orderWithDocs = await this.orderRepository.findOne({ where: { id: order.id }, relations: ['documents'] });
    let uploadedTypes = new Set((orderWithDocs?.documents || []).map((d) => d.type));
    let missing = required.filter((r) => !uploadedTypes.has(r));

    // Defensive retry: try re-querying a few times to tolerate races where the
    // frontend uploaded and registered documents very shortly before calling
    // requestApproval. This avoids flakey failures in fast UI flows.
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const maxAttempts = 5;
    let attempt = 0;
    while (missing.length > 0 && attempt < maxAttempts) {
      attempt += 1;
      try {
        const docs = await this.orderDocumentRepository.findByOrderId(order.id);
        uploadedTypes = new Set((docs || []).map((d) => d.type));
        missing = required.filter((r) => !uploadedTypes.has(r));
        if (missing.length === 0) break;
        // small backoff before next recheck
        // eslint-disable-next-line no-await-in-loop
        await sleep(150);
      } catch (e) {
        console.warn(`requestApproval: failed to re-query documents for order=${order.id} attempt=${attempt}`, e);
        // small delay and retry
        // eslint-disable-next-line no-await-in-loop
        await sleep(150);
      }
    }

    if (missing.length > 0) {
      console.warn(`requestApproval: order=${order.id} missing docs after ${attempt} attempts; uploaded=[${[...uploadedTypes].join(', ')}] required=[${required.join(', ')}]`);
    }

    if (missing.length > 0) {
      // Include uploaded types in the error payload to help clients debug
      throw new BadRequestException({
        message: `Missing required documents for status ${targetStatus}: ${missing.join(', ')}`,
        missing,
        uploaded: [...uploadedTypes],
      });
    }

    order.awaitingApprovalFor = targetStatus;
    order.awaitingApprovalAt = new Date();

    // TODO: send notification to buyer (email/in-app)

    return this.orderRepository.save(order);
  }

  // Buyer approves a pending approval request
  async approvePendingApproval(orderId: string, userId: string): Promise<Order> {
    const order = await this.findOne(orderId, userId);
    const isBuyer = order.globalBuyer?.userId === userId;
    if (!isBuyer) throw new ForbiddenException('Only buyer can approve');
    if (!order.awaitingApprovalFor) throw new BadRequestException('No pending approval for this order');
    const target = order.awaitingApprovalFor as OrderStatus;

    // If current status is already the target or beyond it, treat the
    // approval as idempotent: clear awaitingApproval markers and return.
    // This prevents errors when the buyer has already marked the order
    // as completed (or otherwise advanced) via another flow.
    const ORDER_STATUS_ORDER: OrderStatus[] = this.getStatusSequence();
    const currentIndex = ORDER_STATUS_ORDER.indexOf(order.status);
    const targetIndex = ORDER_STATUS_ORDER.indexOf(target);
    if (currentIndex >= 0 && targetIndex >= 0 && currentIndex >= targetIndex) {
      try {
        console.warn(`[approvePendingApproval] order=${order.id} current status=${order.status} is at/after target=${target}; clearing awaitingApproval markers and returning`);
      } catch (e) {
        // ignore logging errors
      }
      order.awaitingApprovalFor = null;
      order.awaitingApprovalAt = null;
      return this.orderRepository.save(order);
    }

    // Validate transition is allowed from current status
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
      [OrderStatus.IN_PRODUCTION]: [OrderStatus.READY_FOR_SHIPMENT, OrderStatus.CANCELLED],
      [OrderStatus.READY_FOR_SHIPMENT]: [OrderStatus.SHIPPED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.DISPUTED]: [...this.approvalRequiredStatuses, OrderStatus.CANCELLED],
    };

    if (!validTransitions[order.status].includes(target)) {
      throw new BadRequestException(`Cannot transition from ${order.status} to ${target}`);
    }

    // Ensure required documents are present for the target status (with retry)
    const required = this.requiredDocsForStatus[target] ?? [];
    if (required.length > 0) {
      const orderWithDocs = await this.orderRepository.findOne({ where: { id: order.id }, relations: ['documents'] });
      let uploadedTypes = new Set((orderWithDocs?.documents || []).map((d) => d.type));
      let missing = required.filter((r) => !uploadedTypes.has(r));

      // Retry loop (same pattern as above)
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
      const maxAttempts = 5;
      let attempt = 0;
      while (missing.length > 0 && attempt < maxAttempts) {
        attempt += 1;
        try {
          const docs = await this.orderDocumentRepository.findByOrderId(order.id);
          uploadedTypes = new Set((docs || []).map((d) => d.type));
          missing = required.filter((r) => !uploadedTypes.has(r));
          if (missing.length === 0) break;
          // eslint-disable-next-line no-await-in-loop
          await sleep(150);
        } catch (e) {
          console.warn(`approvePendingApproval: failed to re-query documents for order=${order.id} attempt=${attempt}`, e);
          // eslint-disable-next-line no-await-in-loop
          await sleep(150);
        }
      }

      if (missing.length > 0) {
        console.warn(`approvePendingApproval: order=${order.id} missing docs after ${attempt} attempts; uploaded=[${[...uploadedTypes].join(', ')}] required=[${required.join(', ')}]`);
        throw new BadRequestException({
          message: `Missing required documents for status ${target}: ${missing.join(', ')}`,
          missing,
          uploaded: [...uploadedTypes],
        });
      }
    }

    // Perform status update with auto-complete rule for Delivered approval
    const now = new Date();
    if (target === OrderStatus.DELIVERED) {
      // Approving delivered immediately completes order
      order.status = OrderStatus.COMPLETED;
      order.deliveredAt = now;
      order.completedAt = now;
      order.notes = (order.notes || '') + `\n[auto_completed_after_delivery_approval] at=${now.toISOString()}`;
    } else {
      order.status = target;
      switch (target) {
        case OrderStatus.CONFIRMED:
          order.confirmedAt = now;
          break;
        case OrderStatus.SHIPPED:
          order.shippedAt = now;
          break;
        case OrderStatus.CANCELLED:
          order.cancelledAt = now;
          break;
        case OrderStatus.COMPLETED:
          order.completedAt = now;
          break;
      }
    }

    // Clear awaiting approval markers
    order.awaitingApprovalFor = null;
    order.awaitingApprovalAt = null;

    return this.orderRepository.save(order);
  }

  // Buyer rejects pending approval (creates a dispute and marks order as DISPUTED)
  async rejectPendingApproval(orderId: string, userId: string, reason?: string): Promise<Order> {
    const order = await this.findOne(orderId, userId);
    const isBuyer = order.globalBuyer?.userId === userId;
    if (!isBuyer) throw new ForbiddenException('Only buyer can reject');
    if (!order.awaitingApprovalFor) throw new BadRequestException('No pending approval for this order');
    // Preserve the status prior to dispute so a later withdrawal restores the correct stage
    if (!order.previousStatus) {
      order.previousStatus = order.status;
    }
    // Mark disputed and save a structured note (UI can parse tags in square brackets)
    const ts = new Date().toISOString();
    order.status = OrderStatus.DISPUTED;
    order.notes = (order.notes || '') + `\n[dispute_opened_by_buyer_rejection] at=${ts} target=${order.awaitingApprovalFor} reason="${(reason || 'Rejected by buyer').replace(/"/g, '\"')}"`;
    order.awaitingApprovalFor = null;
    order.awaitingApprovalAt = null;
    // Record opener so exporter cannot withdraw buyer-initiated dispute
    order.disputeOpenedBy = userId;

    return this.orderRepository.save(order);
  }

  // Open a dispute (either party) — enhanced: store previous status and set escalation
  async openDispute(orderId: string, userId: string, note?: string, escalationDays = 14): Promise<Order> {
    const order = await this.findOne(orderId, userId);

    // Disputes limited to milestone stages or while awaiting milestone approval
    if ([OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(order.status)) {
      throw new BadRequestException('Cannot open dispute on completed or cancelled orders');
    }
      const milestoneStatuses: OrderStatus[] = [...this.approvalRequiredStatuses];
    const isAwaitingMilestone = !!order.awaitingApprovalFor;
    if (!milestoneStatuses.includes(order.status) && !isAwaitingMilestone) {
      throw new BadRequestException('Dispute can only be opened during shipment milestone stages');
    }

    // Preserve previous status so it can be restored if dispute is withdrawn
    order.previousStatus = order.status;
    order.status = OrderStatus.DISPUTED;
    // Record who opened the dispute and include a timestamp to make notes auditable
    const now = new Date();
    const ts = now.toISOString();
  order.notes = (order.notes || '') + `\n[dispute] by=${userId} at=${ts} ${note || ''}`;
  order.disputeOpenedBy = userId;

    // compute escalation timestamp
    const esc = new Date();
    esc.setDate(esc.getDate() + escalationDays);
    order.disputeEscalationAt = esc;

    // Clear approval markers if present
    order.awaitingApprovalFor = null;
    order.awaitingApprovalAt = null;

    return this.orderRepository.save(order);
  }

  // Withdraw an active dispute (buyer chooses to withdraw). If withdrawn, restore previousStatus
  async withdrawDispute(orderId: string, userId: string): Promise<Order> {
    const order = await this.findOne(orderId, userId);
    const isBuyer = order.globalBuyer?.userId === userId;
    const isExporter = order.exporter?.userId === userId;

    if (order.status !== OrderStatus.DISPUTED) {
      throw new BadRequestException('No active dispute to withdraw');
    }

    // Only buyer or exporter (who opened dispute) may withdraw; mediation staff can be added later
    if (!isBuyer && !isExporter) {
      throw new ForbiddenException('Only involved parties may withdraw a dispute');
    }

    // If exporter tries to withdraw and a disputeOpenedBy is defined, enforce opener match
    if (isExporter && !isBuyer && order.disputeOpenedBy && order.disputeOpenedBy !== userId) {
      throw new ForbiddenException('Only the user who opened the dispute may withdraw it');
    }

  // Restore previous status if available, otherwise default to PENDING
    order.status = order.previousStatus || OrderStatus.PENDING;
    order.previousStatus = null;
    order.disputeEscalationAt = null;
    order.mediationAssignedTo = null;
    order.disputeResolutionOutcome = null;
    order.disputeResolvedAt = null;
  order.disputeOpenedBy = null;

  const now2 = new Date();
  // Provide clearer audit + guidance messaging
  const actor = isBuyer ? 'buyer' : (isExporter ? 'exporter' : 'party');
  order.notes = (order.notes || '') + `\n[dispute_withdrawn] by=${userId} role=${actor} at=${now2.toISOString()} restored=${order.status}`;

    return this.orderRepository.save(order);
  }

  // Assign mediation to a Bevars staff member (internal action)
  async assignMediation(orderId: string, mediatorUserId: string, adminUserId: string): Promise<Order> {
    // TODO: enforce admin role check via auth guard; here we do a basic check that adminUserId is involved
    const order = await this.findOne(orderId, adminUserId);
    order.mediationAssignedTo = mediatorUserId;
    order.notes = (order.notes || '') + `\n[mediation_assigned] mediator=${mediatorUserId} by=${adminUserId}`;
    return this.orderRepository.save(order);
  }

  // Resolve a dispute (by mediation team). outcome should be one of pre-agreed strings
  async resolveDispute(orderId: string, mediatorUserId: string, outcome: string, note?: string): Promise<Order> {
    // mediatorUserId is assigned mediator; ensure order is disputed
    const order = await this.findOne(orderId, mediatorUserId);
    if (order.status !== OrderStatus.DISPUTED) {
      throw new BadRequestException('Order is not in dispute');
    }

  order.disputeResolutionOutcome = outcome;
    order.disputeResolvedAt = new Date();
    order.mediationAssignedTo = mediatorUserId;
    if (note) {
      order.notes = (order.notes || '') + `\n[mediation_note] ${note}`;
    }

    // Possible outcomes: 'buyer_accepted' -> cancel or refund; 'exporter_accepted' -> restore previousStatus; 'suggest_correction' -> keep disputed but add instruction
    if (outcome === 'buyer_accepted') {
      // In many cases buyer_accepted implies order cancellation or refund; here we mark cancelled
      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
    } else if (outcome === 'exporter_accepted') {
      // Restore previous status so order may continue
      order.status = order.previousStatus || OrderStatus.PENDING;
    } else if (outcome === 'suggest_correction') {
      // Keep in DISPUTED but add note for correction
      // leave status as DISPUTED but set escalation to null so mediator handles next steps
      order.disputeEscalationAt = null;
    }

    // Clear previous status markers
    order.previousStatus = null;
    order.disputeEscalationAt = null;
  order.disputeOpenedBy = null;

    return this.orderRepository.save(order);
  }

  async listDocuments(orderId: string, userId: string): Promise<OrderDocument[]> {
    // Access: exporter or buyer may view
    const order = await this.findOne(orderId, userId);
    return this.orderDocumentRepository.findByOrderId(orderId);
  }

  /**
   * Return context useful for dispute uploads: the previous status (the status
   * the order was in before it became DISPUTED), the required document types
   * for that status, and the currently uploaded documents for the order.
   * This helps the frontend show which files are missing and which may be
   * re-uploaded by the exporter during dispute resolution.
   */
  async getDisputeContext(orderId: string, userId: string): Promise<{
    previousStatus?: OrderStatus | null;
    requiredDocs: OrderDocumentType[];
    existingDocs: OrderDocument[];
    order: Order;
  }> {
    const order = await this.findOne(orderId, userId);

    // Ensure the order is in dispute; otherwise, the 'dispute context' is the
    // current status's requirements (useful for callers that want to show
    // reupload UI even if dispute isn't active)
    const prevStatus = order.status === OrderStatus.DISPUTED ? order.previousStatus : order.status;

    const requiredForPrev = prevStatus ? (this.requiredDocsForStatus[prevStatus] ?? []) : [];

    const existingDocs = await this.orderDocumentRepository.findByOrderId(orderId);

    return {
      previousStatus: prevStatus ?? null,
      requiredDocs: requiredForPrev,
      existingDocs: existingDocs || [],
      order,
    };
  }

  async create(createDto: {
    offerId: string;
    shippingAddress?: string;
    billingAddress?: string;
    specialInstructions?: string;
  }): Promise<Order> {
    const offer = await this.offerService.findOne(createDto.offerId);
    
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    // Check if order already exists for this offer
    const existingOrder = await this.orderRepository.findOne({
      where: { offerId: offer.id },
    });

    let order: Order;

    if (existingOrder) {
      // If order already exists, update it with the provided information
      order = existingOrder;
    } else {
      // Create new order if it doesn't exist
      order = await this.createFromOffer(offer);
    }

    // Update order with additional information if provided
    if (createDto.shippingAddress) {
      order.shippingAddress = createDto.shippingAddress;
    }
    if (createDto.billingAddress) {
      order.billingAddress = createDto.billingAddress;
    }
    if (createDto.specialInstructions) {
      order.specialInstructions = createDto.specialInstructions;
    }

    return this.orderRepository.save(order);
  }

  async findAll(filters?: {
    status?: OrderStatus;
    exporterId?: string;
    globalBuyerId?: string;
  }): Promise<Order[]> {
    if (filters?.exporterId) {
      return this.orderRepository.findByExporterId(filters.exporterId);
    }

    if (filters?.globalBuyerId) {
      return this.orderRepository.findByGlobalBuyerId(filters.globalBuyerId);
    }

    if (filters?.status) {
      return this.orderRepository.findByStatus(filters.status);
    }

    return this.orderRepository.find({
      relations: ['offer', 'globalBuyer', 'exporter'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findOne(id: string, userId?: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['offer', 'globalBuyer', 'globalBuyer.user', 'exporter', 'exporter.user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Optional access control check
    if (userId) {
      const hasAccess = 
        order.globalBuyer?.userId === userId || 
        order.exporter?.userId === userId;

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this order');
      }
    }

    return order;
  }

  /**
   * Enriched order payload with derived dispute metadata for frontend convenience.
   * Does NOT persist anything – purely computed fields.
   */
  async findOneWithDerived(id: string, userId: string): Promise<any> {
    const order = await this.findOne(id, userId);
    const notes = order.notes || '';
    // Determine dispute source from structured markers
    let disputeSource: 'buyer_rejection' | 'manual' | null = null;
    if (notes.includes('[dispute_opened_by_buyer_rejection]')) {
      disputeSource = 'buyer_rejection';
    } else if (order.status === OrderStatus.DISPUTED) {
      // Generic dispute marker inserted via openDispute
      if (notes.includes('[dispute]')) disputeSource = 'manual';
    }
    const userIsBuyer = order.globalBuyer?.userId === userId;
    const userIsExporter = order.exporter?.userId === userId;
    let canWithdrawDispute = false;
    if (order.status === OrderStatus.DISPUTED) {
      if (order.disputeOpenedBy) {
        // Only opener may withdraw unless opener is buyer (policy: exporter cannot withdraw buyer dispute)
        if (order.disputeOpenedBy === userId) {
          canWithdrawDispute = true;
        } else if (userIsBuyer && order.disputeOpenedBy === order.globalBuyer?.userId) {
          // Buyer always can withdraw their own dispute
          canWithdrawDispute = true;
        }
      } else {
        // Fallback: allow buyer to withdraw if no opener recorded
        if (userIsBuyer) canWithdrawDispute = true;
      }
    }
    return {
      ...order,
      disputeSource,
      canWithdrawDispute,
    };
  }

  async findByOfferId(offerId: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { offerId },
      relations: ['offer', 'globalBuyer', 'globalBuyer.user', 'exporter', 'exporter.user'],
    });
  }

  async findByOrderNumber(orderNumber: string): Promise<Order> {
    const order = await this.orderRepository.findByOrderNumber(orderNumber);
    
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateStatus(id: string, status: OrderStatus, userId: string): Promise<Order> {
    const order = await this.findOne(id, userId);

    // Validate status transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.IN_PRODUCTION, OrderStatus.CANCELLED],
      [OrderStatus.IN_PRODUCTION]: [OrderStatus.READY_FOR_SHIPMENT, OrderStatus.CANCELLED],
      [OrderStatus.READY_FOR_SHIPMENT]: [OrderStatus.SHIPPED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.DISPUTED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    };

    // Special case: allow DISPUTED -> previousStatus (restore) if previousStatus matches requested status
    if (order.status === OrderStatus.DISPUTED && order.previousStatus) {
      if (status === order.previousStatus) {
        // allow restore
      } else if (!validTransitions[order.status].includes(status)) {
        throw new BadRequestException(`Cannot transition from ${order.status} to ${status}`);
      }
    } else if (!validTransitions[order.status].includes(status)) {
      throw new BadRequestException(`Cannot transition from ${order.status} to ${status}`);
    }

    // NOTE: Linear sequencing for progress UIs should prefer getLifecycleMeta().orderedStatuses
    // rather than reconstructing their own arrays client-side.

    // Role enforcement: only exporter can move to shipment / production stages.
    // Exporter and buyer are both allowed to confirm an order, however the
    // required documents check (see below) enforces that a PURCHASE_ORDER is
    // present for CONFIRMED. This prevents exporters from confirming without
    // the buyer's PO attached.
    const isExporter = order.exporter?.userId === userId;
    const isBuyer = order.globalBuyer?.userId === userId;

    const exporterOnly = [
      OrderStatus.IN_PRODUCTION,
      OrderStatus.READY_FOR_SHIPMENT,
      OrderStatus.SHIPPED,
    ];

    if (exporterOnly.includes(status) && !isExporter) {
      throw new ForbiddenException('Only exporter can change order to this status');
    }

    // Validate required documents for the target status
    const required = this.requiredDocsForStatus[status] ?? [];
    if (required.length > 0) {
      // reload order with documents relation
      const orderWithDocs = await this.orderRepository.findOne({
        where: { id: order.id },
        relations: ['documents', 'exporter', 'globalBuyer'],
      });

      const uploadedTypes = new Set((orderWithDocs?.documents || []).map((d) => d.type));
      const missing = required.filter((r) => !uploadedTypes.has(r));
      if (missing.length > 0) {
        // Provide structured error similar to requestApproval / approve flows for consistent frontend parsing
        throw new BadRequestException({
          message: `Missing required documents for status ${status}: ${missing.join(', ')}`,
          status,
          missing,
          uploaded: [...uploadedTypes],
        });
      }
    }

    order.status = status;

    // Set timestamp fields based on status
    const now = new Date();
    switch (status) {
      case OrderStatus.CONFIRMED:
        order.confirmedAt = now;
        break;
      case OrderStatus.SHIPPED:
        order.shippedAt = now;
        break;
      case OrderStatus.DELIVERED:
        order.deliveredAt = now;
        break;
      case OrderStatus.COMPLETED:
        order.completedAt = now;
        break;
      case OrderStatus.CANCELLED:
        order.cancelledAt = now;
        break;
    }

    return this.orderRepository.save(order);
  }

  async cancel(id: string, userId: string, reason?: string): Promise<Order> {
    const order = await this.findOne(id, userId);

    if (![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
      throw new BadRequestException('Can only cancel pending or confirmed orders');
    }

    order.status = OrderStatus.CANCELLED;
    order.cancellationReason = reason;
    order.cancelledAt = new Date();

    return this.orderRepository.save(order);
  }

  async update(id: string, updateDto: {
    shippingAddress?: string;
    billingAddress?: string;
    specialInstructions?: string;
    expectedDeliveryDate?: Date;
    notes?: string;
  }, userId: string): Promise<Order> {
    const order = await this.findOne(id, userId);

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Can only update pending or confirmed orders');
    }

    Object.assign(order, updateDto);

    return this.orderRepository.save(order);
  }

  async getMyOrders(userId: string, isExporter = false): Promise<Order[]> {
    if (isExporter) {
      // Find exporter first, then get their orders
      const orders = await this.orderRepository.find({
        where: { exporter: { userId } },
        relations: ['offer', 'globalBuyer', 'globalBuyer.user'],
        order: { createdAt: 'DESC' },
      });
      return orders;
    } else {
      // Find global buyer first, then get their orders
      const orders = await this.orderRepository.find({
        where: { globalBuyer: { userId } },
        relations: ['offer', 'exporter', 'exporter.user'],
        order: { createdAt: 'DESC' },
      });
      return orders;
    }
  }

  async getOrderStatistics(userId: string, isExporter = false): Promise<any> {
    // `userId` is the authenticated User.id. We need to resolve it to the
    // corresponding Exporter.id or GlobalBuyer.id before calling the repository.
    if (isExporter) {
      const exporter = await this.exporterService.findByUserId(userId);
      return this.orderRepository.getOrderStatistics(exporter.id);
    } else {
      const buyer = await this.globalBuyerService.findByUserId(userId);
      return this.orderRepository.getOrderStatistics(undefined, buyer.id);
    }
  }

  // Confirm delivery by buyer
  async confirmDelivery(orderId: string, userId: string): Promise<Order> {
    const order = await this.findOne(orderId, userId);

    // Only allow buyer to confirm delivery and only when status is SHIPPED
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException('Order must be shipped before confirming delivery');
    }

    const isBuyer = order.globalBuyer?.userId === userId;
    if (!isBuyer) {
      throw new ForbiddenException('Only buyer can confirm delivery');
    }

    order.status = OrderStatus.DELIVERED;
    order.deliveredAt = new Date();

    return this.orderRepository.save(order);
  }

  // Open dispute (either party) — mark status as DISPUTED and capture an optional note via notes
  // ...existing dispute methods are implemented above (openDispute with escalation, withdrawDispute, assignMediation, resolveDispute)

  // Reviews: create a review for an order (one review per role per order not enforced here)
  async createReview(orderId: string, userId: string, rating: number, comment: string, role: 'exporter' | 'global_buyer') {
    const order = await this.findOne(orderId, userId);

    // Only allow reviews on completed orders
    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException('Can only review after order is completed');
    }

    const review = this.orderReviewRepository.create({ orderId, rating, comment, userId, role: role as any });
    return this.orderReviewRepository.save(review);
  }

  async listReviews(orderId: string, userId?: string) {
    // optional access control via findOne
    if (userId) await this.findOne(orderId, userId);
    return this.orderReviewRepository.findByOrderId(orderId);
  }
}
