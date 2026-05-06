import { API_BASE } from './api-base';
import { requestRawApiResponse as requestRawTransportApiResponse } from '@/shared/lib/transport';

export async function requestRawApiResponse<T>(
  endpoint: string,
  options: RequestInit = {}
) {
  return await requestRawTransportApiResponse<T>(API_BASE, endpoint, options);
}
