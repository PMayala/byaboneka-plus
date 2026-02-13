// ============================================
// ADD THESE IMPORTS at the top of src/index.ts
// (after the existing imports)
// ============================================

import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import app from '.';

// ============================================
// ADD THIS BLOCK in src/index.ts
// AFTER: app.use('/api/v1', enhancedRoutes);
// BEFORE: // Root endpoint
// ============================================

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Byaboneka+ API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'none',
    filter: true,
    tagsSorter: 'alpha',
  },
}));

// Serve raw OpenAPI JSON spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});