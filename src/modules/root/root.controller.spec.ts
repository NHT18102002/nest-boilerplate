import { Test, type TestingModule } from '@nestjs/testing';
import { RootController } from './root.controller';
import { RootService } from './root.service';

describe('RootController', () => {
  let controller: RootController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RootController],
      providers: [
        {
          provide: RootService,
          useValue: {
            getHealth: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RootController>(RootController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
