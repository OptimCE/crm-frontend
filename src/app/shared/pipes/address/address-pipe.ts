import { Pipe, PipeTransform } from '@angular/core';
import { AddressDTO } from '../../dtos/address.dtos';

@Pipe({
  name: 'address',
  standalone: true,
})
export class AddressPipe implements PipeTransform {
  transform(value: AddressDTO): string {
    return value.street + ' ' + value.number + '<br>' + value.postcode + ' ' + value.city;
  }
}
