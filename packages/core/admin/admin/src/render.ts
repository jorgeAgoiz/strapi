/* eslint-disable no-undef */
import { getFetchClient } from '@strapi/helper-plugin';
import { createRoot } from 'react-dom/client';

import { StrapiApp, StrapiAppConstructorArgs } from './StrapiApp';

interface RenderAdminArgs {
  plugins: StrapiAppConstructorArgs['appPlugins'];
}

const renderAdmin = async (mountNode: HTMLElement | null, { plugins }: RenderAdminArgs) => {
  if (!mountNode) {
    throw new Error('[@strapi/admin]: Could not find the root element to mount the admin app');
  }

  // @ts-expect-error – there's pollution from the global scope of Node.
  window.strapi = {
    /**
     * This ENV variable is passed from the strapi instance, by default no url is set
     * in the config and therefore the instance returns you an empty string so URLs are relative.
     *
     * To ensure that the backendURL is always set, we use the window.location.origin as a fallback.
     */
    backendURL: process.env.STRAPI_ADMIN_BACKEND_URL || window.location.origin,
    isEE: false,
    telemetryDisabled: process.env.STRAPI_TELEMETRY_DISABLED === 'true' ? true : false,
    features: {
      SSO: 'sso',
      AUDIT_LOGS: 'audit-logs',
      REVIEW_WORKFLOWS: 'review-workflows',
      /**
       * If we don't get the license then we know it's not EE
       * so no feature is enabled.
       */
      isEnabled: () => false,
    },
    projectType: 'Community',
    flags: {
      nps: false,
      promoteEE: true,
    },
  };

  const { get } = getFetchClient();

  interface ProjectType extends Pick<Window['strapi'], 'flags'> {
    isEE: boolean;
    features: {
      name: string;
    }[];
  }

  try {
    const {
      data: {
        data: { isEE, features, flags },
      },
    } = await get<{ data: ProjectType }>('/admin/project-type');

    window.strapi.isEE = isEE;
    window.strapi.flags = flags;
    window.strapi.features = {
      ...window.strapi.features,
      isEnabled: (featureName) => features.some((feature) => feature.name === featureName),
    };
    window.strapi.projectType = isEE ? 'Enterprise' : 'Community';
  } catch (err) {
    /**
     * If this fails, we simply don't activate any EE features.
     * Should we warn clearer in the UI?
     */
    console.error(err);
  }

  const app = new StrapiApp({
    adminConfig: {},
    appPlugins: plugins,
  });

  await app.bootstrapAdmin();
  await app.initialize();
  await app.bootstrap();
  await app.loadTrads();

  createRoot(mountNode).render(app.render());

  if (
    typeof module !== 'undefined' &&
    module &&
    'hot' in module &&
    typeof module.hot === 'object' &&
    module.hot !== null &&
    'accept' in module.hot &&
    typeof module.hot.accept === 'function'
  ) {
    module.hot.accept();
  }
};

export { renderAdmin };
export type { RenderAdminArgs };
