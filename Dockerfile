# Build stage
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Set environment to development for installing dev dependencies and building the application
ENV NODE_ENV=development

ARG FRONTEND_API_URL=http://localhost:8080
ARG FRONTEND_BASE_PATH=http://localhost:4200
ARG FRONTEND_KEYCLOAK_REALM=optimce-realm
ARG FRONTEND_KEYCLOAK_URL=http://localhost:8081
ARG FRONTEND_KEYCLOAK_CLIENT_ID=optimce-frontend

# Copy package files
COPY package*.json ./

#Install git for fetching dependencies that might be hosted on git repositories
# RUN apk add --no-cache git #Not need rignt now

# Install dependencies
RUN npm ci
RUN npm cache clean --force

# Copy the entire application
COPY . .

# Inject environment variables at build stage (static in built assets)
RUN cat > src/environments/environments.ts <<EOF
const apiUrl = '${FRONTEND_API_URL}';

export const environments = {
	apiUrl,
	basePath: '${FRONTEND_BASE_PATH}',
	keycloak: {
		realm: '${FRONTEND_KEYCLOAK_REALM}',
		url: '${FRONTEND_KEYCLOAK_URL}',
		clientId: '${FRONTEND_KEYCLOAK_CLIENT_ID}',
		urlPattern: new RegExp('^(' + apiUrl + ')(/.*)?$', 'i')
	}
};
EOF

# Build the Angular application
RUN npm run build



# Production stage - serve with nginx
FROM nginx:1.27-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy nginx configuration (optional,we use the default one for now, but you can customize it if needed)
# COPY nginx.conf /etc/nginx/nginx.conf
# COPY default.conf /etc/nginx/conf.d/default.conf

# Copy built Angular app from builder stage
COPY --from=builder /app/dist/crm-frontend/browser /usr/share/nginx/html

# Set working directory
WORKDIR /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
