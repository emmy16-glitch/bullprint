import entry from './entry.js';
import { reconcileDistributionStats } from './reconcile.js';

export default {
  fetch(request, env, context) {
    return entry.fetch(request, env, context);
  },

  scheduled(controller, env, context) {
    const result = entry.scheduled(controller, env, context);
    context.waitUntil(reconcileDistributionStats(env));
    return result;
  },
};
