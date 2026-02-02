import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedVerificationRequirements1759850000000 implements MigrationInterface {
    name = 'SeedVerificationRequirements1759850000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Clear existing requirements
        await queryRunner.query(`DELETE FROM "verification_requirement"`);

        // Exporter verification requirements (generic for all African countries)
        const exporterDocs = [
            { documentType: 'business_registration', label: 'Business Registration Certificate', required: true, displayOrder: 1 },
            { documentType: 'export_license', label: 'Export License/Permit', required: true, displayOrder: 2 },
            { documentType: 'tax_certificate', label: 'Tax Registration Certificate', required: true, displayOrder: 3 },
            { documentType: 'product_certification', label: 'Product Certification (if applicable)', required: false, displayOrder: 4 },
            { documentType: 'phytosanitary_certificate', label: 'Phytosanitary/Health Certificate (if applicable)', required: false, displayOrder: 5 },
            { documentType: 'bank_reference', label: 'Bank Reference Letter', required: false, displayOrder: 6 },
            { documentType: 'facility_photos', label: 'Facility Photos', required: false, displayOrder: 7 },
            { documentType: 'quality_certifications', label: 'Quality Certifications', required: false, displayOrder: 8 },
        ];

        for (const doc of exporterDocs) {
            await queryRunner.query(`
                INSERT INTO "verification_requirement" ("ownerType", "documentType", "label", "required", "displayOrder")
                VALUES ('exporter', '${doc.documentType}', '${doc.label}', ${doc.required}, ${doc.displayOrder})
            `);
        }

        // Buyer verification requirements (generic for all countries)
        const buyerDocs = [
            { documentType: 'company_registration', label: 'Company Registration Certificate', required: true, displayOrder: 1 },
            { documentType: 'business_license', label: 'Import/Trade License', required: true, displayOrder: 2 },
            { documentType: 'tax_registration', label: 'Tax Registration/VAT Certificate', required: true, displayOrder: 3 },
            { documentType: 'bank_statement', label: 'Bank Statement (last 3 months)', required: true, displayOrder: 4 },
            { documentType: 'financial_statement', label: 'Financial Statements', required: true, displayOrder: 5 },
            { documentType: 'trade_references', label: 'Trade References', required: false, displayOrder: 6 },
            { documentType: 'credit_report', label: 'Credit Report', required: false, displayOrder: 7 },
            { documentType: 'facility_photos', label: 'Facility Photos', required: false, displayOrder: 8 },
        ];

        for (const doc of buyerDocs) {
            await queryRunner.query(`
                INSERT INTO "verification_requirement" ("ownerType", "documentType", "label", "required", "displayOrder")
                VALUES ('buyer', '${doc.documentType}', '${doc.label}', ${doc.required}, ${doc.displayOrder})
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "verification_requirement"`);
    }
}
