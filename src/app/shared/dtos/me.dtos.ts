import { CommunityDTO } from './community.dtos';
import { DocumentExposedDTO, DocumentQueryDTO } from './document.dtos';
import { MeterPartialQuery, MetersDTO, PartialMeterDTO } from './meter.dtos';
import { CompanyDTO, IndividualDTO, MemberPartialQuery, MembersPartialDTO } from './member.dtos';

export interface MeMemberPartialQuery extends MemberPartialQuery {
  community_name?: string;
}

export interface MeMetersPartialQuery extends MeterPartialQuery {
  community_name?: string;
}

export interface MeDocumentPartialQuery extends DocumentQueryDTO {
  community_name?: string;
}

export interface MeMembersPartialDTO extends MembersPartialDTO {
  community: CommunityDTO;
}

export interface MeIndividualDTO extends IndividualDTO {
  community: CommunityDTO;
}

export interface MeCompanyDTO extends CompanyDTO {
  community: CommunityDTO;
}

export interface MePartialMeterDTO extends PartialMeterDTO {
  community: CommunityDTO;
}

export interface MeMeterDTO extends MetersDTO {
  community: CommunityDTO;
}

export interface MeDocumentDTO extends DocumentExposedDTO {
  community: CommunityDTO;
}
