import { AppDataSource } from '../ormconfig';
import { Exporter } from 'src/exporter/entities/exporter.entity';
import { VerificationDocument } from 'src/common/entities/verification-document.entity';
import { BuyerVerificationDocument } from 'src/global-buyer/entities/buyer-verification-document.entity';
import { VerificationStatus } from 'src/exporter/entities/exporter.entity';

async function run() {
  await AppDataSource.initialize();
  const exporterRepo = AppDataSource.getRepository(Exporter);
  const verRepo = AppDataSource.getRepository(VerificationDocument);
  const buyerDocRepo = AppDataSource.getRepository(BuyerVerificationDocument);

  console.log('Backfilling exporters...');
  const exporters = await exporterRepo.find();
  for (const e of exporters) {
    const docs = ((e as any).verificationDocuments || {}) as Record<string, any>;
    for (const docType of Object.keys(docs)) {
      const url = docs[docType];
      if (!url) continue;
      const exists = await verRepo.findOne({ where: { ownerId: e.id, documentType: docType } });
      if (!exists) {
        const doc = verRepo.create({ ownerId: e.id, documentType: docType, fileUrl: url, status: VerificationStatus.PENDING });
        // set relation if possible
        (doc as any).exporter = e;
        await verRepo.save(doc);
      }
    }
  }

  console.log('Backfilling buyer verification rows...');
  const buyerDocs = await buyerDocRepo.find();
  for (const d of buyerDocs) {
    const buyerId = (d as any).buyerId;
    const exists = await verRepo.findOne({ where: { ownerId: buyerId, documentType: (d as any).documentType } });
    if (!exists) {
      const doc = verRepo.create({ ownerId: buyerId, documentType: (d as any).documentType, fileUrl: (d as any).fileUrl, status: (d as any).status || VerificationStatus.PENDING });
      // don't rely on loaded relation
      await verRepo.save(doc);
    }
  }

  console.log('Backfill complete');
  await AppDataSource.destroy();
}

run().catch(err => { console.error(err); process.exit(1); });
