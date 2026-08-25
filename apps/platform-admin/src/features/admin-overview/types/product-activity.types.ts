export type ProductActivityAudience = 'external' | 'internal' | 'qa';

export type AdminProductActivityOverview = {
  timezone: 'Asia/Shanghai';
  asOfDate: string;
  filters: {
    audience: ProductActivityAudience;
    environment: 'production' | 'development' | 'test';
    releaseChannel: 'stable' | 'beta' | 'nightly' | 'development';
    trendDays: number;
  };
  metrics: {
    dau: number;
    wau: number;
    mau: number;
    successfulDau: number;
    successfulWau: number;
    successfulMau: number;
  };
  trend: Array<{
    date: string;
    active: number;
    successful: number;
  }>;
};
