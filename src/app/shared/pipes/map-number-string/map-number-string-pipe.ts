import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'mapNumberString',
  standalone: true,
})
export class MapNumberStringPipe implements PipeTransform {
  transform(value: number, map: string[]): string {
    return map[value];
  }
}
