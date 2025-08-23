import { Controller, Get, Query } from '@nestjs/common';

@Controller('market-trends')
export class MarketTrendsController {
  
  @Get()
  async getMarketTrends(@Query('timePeriod') timePeriod: string = 'last30days') {
    // For MVP, return mock market trends data
    return {
      overview: {
        averagePrice: {
          value: 125.50,
          unit: 'USD/MT',
          change: 5.2
        },
        supplyVolume: {
          value: 15400,
          unit: 'MT',
          change: -2.1
        },
        activeBuyers: {
          value: 342,
          change: 8.7
        },
        marketForecast: {
          status: 'Rising' as const,
          outlook: 'Prices expected to increase due to seasonal demand'
        }
      },
      priceTrends: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Average Price',
            data: [120, 118, 122, 125, 128, 125]
          }
        ]
      },
      supplyDemand: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        supply: [1200, 1150, 1300, 1400],
        demand: [1100, 1250, 1200, 1350]
      },
      forecast: {
        labels: ['Jul', 'Aug', 'Sep', 'Oct'],
        predicted: [130, 135, 132, 128],
        actual: [128, 133, 131, 0] // 0 for future months
      },
      insights: {
        priceVolatility: 'Medium' as const,
        supplyChainHealth: 'Good' as const,
        marketSentiment: 'Positive' as const
      }
    };
  }
}
