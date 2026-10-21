import { Logger } from 'tslog';
import { LiteLogger } from 'tslog/lite';

const isDEV = import.meta.env.MODE === 'development';

export const log = isDEV
  ? new Logger({
      name: 'efp3d',
      type: 'pretty',
      minLevel: 0,
    })
  : new LiteLogger({
      name: 'efp3d',
      minLevel: 4,
    });

export const subLogger = (id: string) => log.getSubLogger({ name: id });
