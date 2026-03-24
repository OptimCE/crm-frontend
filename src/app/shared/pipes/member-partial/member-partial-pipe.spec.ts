import { MemberPartialPipe } from './member-partial-pipe';
import { MembersPartialDTO } from '../../dtos/member.dtos';
import { MemberStatus, MemberType } from '../../types/member.types';

describe('MemberPartialPipe', () => {
  let pipe: MemberPartialPipe;

  beforeEach(() => {
    pipe = new MemberPartialPipe();
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return the name from a valid MembersPartialDTO', () => {
    const dto: MembersPartialDTO = {
      id: 1,
      name: 'John Doe',
      member_type: MemberType.INDIVIDUAL,
      status: MemberStatus.ACTIVE,
    };
    expect(pipe.transform(dto)).toBe('John Doe');
  });

  it('should return an empty string when name is empty', () => {
    const dto: MembersPartialDTO = {
      id: 2,
      name: '',
      member_type: MemberType.COMPANY,
      status: MemberStatus.INACTIVE,
    };
    expect(pipe.transform(dto)).toBe('');
  });

  it('should handle names with special and accented characters', () => {
    const dto: MembersPartialDTO = {
      id: 3,
      name: 'José García-López',
      member_type: MemberType.INDIVIDUAL,
      status: MemberStatus.PENDING,
    };
    expect(pipe.transform(dto)).toBe('José García-López');
  });

  it('should return only the name, not other DTO fields', () => {
    const dto: MembersPartialDTO = {
      id: 99,
      name: 'Alice',
      member_type: MemberType.COMPANY,
      status: MemberStatus.ACTIVE,
    };
    const result = pipe.transform(dto);
    expect(result).toBe('Alice');
    expect(result).not.toBe(99 as unknown);
  });
});
