import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';

async function loadRuntimeConfig() {
	try {
		const response = await fetch('/assets/config/config.json', {
			cache: 'no-store',
		});

		if (!response.ok) {
			throw new Error(`Unable to load runtime config: ${response.status}`);
		}

		const config = await response.json();
		const { setRuntimeConfig } = await import('./environments/environments');
		setRuntimeConfig(config);
	} catch (error) {
		console.error('Runtime config loading failed, fallback to defaults.', error);
	}
}

async function bootstrap() {
	await loadRuntimeConfig();

	const [{ appConfig }, { App }] = await Promise.all([
		import('./app/app.config'),
		import('./app/app'),
	]);

	await bootstrapApplication(App, appConfig);
}

bootstrap().catch((err) => console.error(err));
