import { ApiProperty } from '@nestjs/swagger';
import {
  BeforeInsert,
  CreateDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

export class BaseEntity {
  @ApiProperty()
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
