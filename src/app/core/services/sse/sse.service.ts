import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SSEService {
  getServerSentEvent(url: string) {
    return new Observable((observer) => {
      const eventSource = new EventSource(url, { withCredentials: true });
      eventSource.onmessage = (event) => {
        observer.next(JSON.parse(event.data));
      };
      eventSource.onerror = (error) => {
        console.log(`OnError ${error}`);
      };
    });
  }
}
