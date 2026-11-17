import { createVitestConfig } from '../../stryker.base.config.mjs';

export default createVitestConfig((name) => import.meta.resolve(name), { checkers: [] });
