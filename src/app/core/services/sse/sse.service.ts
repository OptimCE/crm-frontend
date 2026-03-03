import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { ApiResponse } from '../../dtos/api.response';

@Injectable({
  providedIn: 'root',
})
export class SSEService {
  getServerSentEvent(url: string): Observable<ApiResponse<string>> {
    return new Observable((observer) => {
      const eventSource = new EventSource(url, { withCredentials: true });
      eventSource.onmessage = (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data) as { data: string; error_code?: number };
          observer.next(new ApiResponse<string>(parsed.data, parsed.error_code));
        } catch (e) {
          observer.error(new Error(`Failed to parse SSE message: ${String(e)}`));
        }
      };
      eventSource.onerror = () => {
        observer.error(new Error('SSE connection error'));
      };
    });
  }
}
