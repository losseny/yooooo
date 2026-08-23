export abstract class BaseEntity {
  static defaultLastUpdatedDate = new Date('2023-11-01T00:00:00.000Z');

  id: string;

  createdAt: Date;

  updatedAt: Date;

  deletedAt?: Date;

  // FIXME gives circular import issues when using the CLI, should fix this sometime...
  // @ManyToOne(() => User)
  // createdBy: User;
}
