import { Controller, Get } from '@nestjs/common';

@Controller('crops')
export class CropsController {
  @Get()
  findAll() {
    // Minimal static list to unblock UI; replace with DB-backed source when ready
    const data = [
      { id: 'cashew', type: 'Nuts', name: 'Cashew Nuts', price: '0', description: 'Cashew', quantity: '0', condition: ['Raw'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'sesame', type: 'Grains', name: 'Sesame Seeds', price: '0', description: 'Sesame', quantity: '0', condition: ['Natural'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'ginger', type: 'Spices', name: 'Ginger', price: '0', description: 'Ginger', quantity: '0', condition: ['Fresh'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'cocoa', type: 'Cash Crop', name: 'Cocoa Beans', price: '0', description: 'Dried cocoa beans', quantity: '0', condition: ['Fermented', 'Dried'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'coffee', type: 'Cash Crop', name: 'Coffee Beans', price: '0', description: 'Arabica/Robusta green coffee', quantity: '0', condition: ['Green'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'tea', type: 'Cash Crop', name: 'Tea Leaves', price: '0', description: 'Processed black/green tea', quantity: '0', condition: ['Processed'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'shea_butter', type: 'Oils', name: 'Shea Butter', price: '0', description: 'Refined/Unrefined shea butter', quantity: '0', condition: ['Unrefined', 'Refined'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'palm_oil', type: 'Oils', name: 'Palm Oil', price: '0', description: 'Crude palm oil (CPO)', quantity: '0', condition: ['Crude'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'rubber', type: 'Industrial', name: 'Natural Rubber', price: '0', description: 'Rubber sheets/latex', quantity: '0', condition: ['Sheets', 'Latex'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'cotton', type: 'Fibers', name: 'Cotton', price: '0', description: 'Raw cotton lint', quantity: '0', condition: ['Baled'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'hibiscus', type: 'Herbs', name: 'Hibiscus Flowers', price: '0', description: 'Dried hibiscus (zobo) petals', quantity: '0', condition: ['Dried'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'turmeric', type: 'Spices', name: 'Turmeric', price: '0', description: 'Whole or powdered turmeric', quantity: '0', condition: ['Dried'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'black_pepper', type: 'Spices', name: 'Black Pepper', price: '0', description: 'Whole black pepper', quantity: '0', condition: ['Dried'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'groundnut', type: 'Oilseeds', name: 'Groundnuts (Peanuts)', price: '0', description: 'Shelled/unshelled groundnuts', quantity: '0', condition: ['Raw'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'soybean', type: 'Oilseeds', name: 'Soybeans', price: '0', description: 'Clean, dried soybeans', quantity: '0', condition: ['Dried'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'sorghum', type: 'Grains', name: 'Sorghum', price: '0', description: 'Food and feed grade sorghum', quantity: '0', condition: ['Dried'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'millet', type: 'Grains', name: 'Millet', price: '0', description: 'Pearl/finger millet', quantity: '0', condition: ['Dried'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'maize', type: 'Grains', name: 'Maize (Corn)', price: '0', description: 'Yellow/white maize', quantity: '0', condition: ['Dried'], createdAt: new Date(), updatedAt: new Date() },
      { id: 'beans', type: 'Legumes', name: 'Cowpeas (Black-eyed Peas)', price: '0', description: 'Dried cowpeas', quantity: '0', condition: ['Dried'], createdAt: new Date(), updatedAt: new Date() },
    ];
    return { statusCode: 200, message: 'Crops fetched', data };
  }
}

