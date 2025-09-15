import { AppDataSource } from '../ormconfig';
import { VerificationRequirement } from 'src/common/entities/verification-requirement.entity';

async function run() {
  await AppDataSource.initialize();
  const reqRepo = AppDataSource.getRepository(VerificationRequirement);

  const defaults: Partial<VerificationRequirement>[] = [
    // Exporter requirements (match frontend ExporterVerificationFlow)
    { ownerType: 'exporter', documentType: 'cac_certificate', label: 'CAC Certificate', required: true, displayOrder: 1, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
    { ownerType: 'exporter', documentType: 'export_license', label: 'Export License', required: true, displayOrder: 2, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
    { ownerType: 'exporter', documentType: 'nafdac_certificate', label: 'NAFDAC Certificate', required: true, displayOrder: 3, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
    { ownerType: 'exporter', documentType: 'phytosanitary_certificate', label: 'Phytosanitary Certificate', required: true, displayOrder: 4, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
    { ownerType: 'exporter', documentType: 'tax_clearance', label: 'Tax Clearance', required: true, displayOrder: 5, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
    { ownerType: 'exporter', documentType: 'business_permit', label: 'Business Permit', required: false, displayOrder: 6, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
    { ownerType: 'exporter', documentType: 'facility_photos', label: 'Facility Photos', required: false, displayOrder: 7, allowedMimeTypes: ['image/jpeg', 'image/png'], maxFileSizeBytes: 10 * 1024 * 1024 },
    { ownerType: 'exporter', documentType: 'quality_certifications', label: 'Quality Certifications', required: false, displayOrder: 8, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
    // Buyer requirements (match frontend GlobalBuyerVerificationFlow)
    { ownerType: 'buyer', documentType: 'company_registration', label: 'Company Registration Certificate', required: true, displayOrder: 1, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
    { ownerType: 'buyer', documentType: 'business_license', label: 'Business / Import License', required: true, displayOrder: 2, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
    { ownerType: 'buyer', documentType: 'tax_registration', label: 'Tax Registration/VAT Certificate', required: true, displayOrder: 3, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
    { ownerType: 'buyer', documentType: 'bank_statement', label: 'Bank Statement', required: true, displayOrder: 4, allowedMimeTypes: ['application/pdf'], maxFileSizeBytes: 10 * 1024 * 1024 },
    { ownerType: 'buyer', documentType: 'financial_statement', label: 'Financial Statements', required: true, displayOrder: 5, allowedMimeTypes: ['application/pdf'], maxFileSizeBytes: 10 * 1024 * 1024 },
    { ownerType: 'buyer', documentType: 'trade_references', label: 'Trade References', required: false, displayOrder: 6, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
    { ownerType: 'buyer', documentType: 'credit_report', label: 'Credit Report', required: false, displayOrder: 7, allowedMimeTypes: ['application/pdf'], maxFileSizeBytes: 5 * 1024 * 1024 },
    { ownerType: 'buyer', documentType: 'facility_photos', label: 'Facility Photos', required: false, displayOrder: 8, allowedMimeTypes: ['image/jpeg', 'image/png'], maxFileSizeBytes: 10 * 1024 * 1024 },
    { ownerType: 'buyer', documentType: 'certifications', label: 'Industry Certifications', required: false, displayOrder: 9, allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'], maxFileSizeBytes: 5 * 1024 * 1024 },
  ];

  for (const d of defaults) {
    const exists = await reqRepo.findOne({ where: { ownerType: d.ownerType, documentType: d.documentType } });
    if (!exists) {
      const ent = reqRepo.create(d as any);
      await reqRepo.save(ent);
    }
  }

  console.log('Seeding verification requirements complete');
  await AppDataSource.destroy();
}

run().catch(err => { console.error(err); process.exit(1); });
