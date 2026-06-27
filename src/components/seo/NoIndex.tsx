import React from 'react';
import { Helmet } from 'react-helmet-async';

/**
 * Marks the current route as noindex/nofollow for crawlers via meta tag
 * (independent of robots.txt). Use on private/transactional pages such as
 * birth-list views, cart and checkout.
 */
const NoIndex: React.FC = () => (
  <Helmet>
    <meta name="robots" content="noindex, nofollow, noarchive" />
    <meta name="googlebot" content="noindex, nofollow, noarchive" />
  </Helmet>
);

export default NoIndex;
