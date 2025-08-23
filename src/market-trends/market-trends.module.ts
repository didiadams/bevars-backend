import { Module } from '@nestjs/common';
import { MarketTrendsController } from './market-trends.controller';

@Module({
  controllers: [MarketTrendsController],
  providers: [],
  exports: [],
})
export class MarketTrendsModule {}
