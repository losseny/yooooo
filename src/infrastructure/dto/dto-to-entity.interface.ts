import { BaseEntity } from '../../database/entities/base.entity';

export interface ToEntity<DTO, Entity> {
  toEntity(): Entity;
}

export interface ToEntityGeneric {
  toEntity<Entity extends BaseEntity>(cls: new () => Entity): Entity;
}
