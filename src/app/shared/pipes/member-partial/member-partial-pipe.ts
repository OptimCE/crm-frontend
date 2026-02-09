import { Pipe, PipeTransform } from '@angular/core';
import {MembersPartialDTO} from '../../dtos/member.dtos';

@Pipe({
  name: 'memberPartial',
  standalone: true,
})
export class MemberPartialPipe implements PipeTransform {
  transform(value: MembersPartialDTO): unknown {
    return value.name;
  }
}
