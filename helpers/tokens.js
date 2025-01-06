import 'dotenv/config';

export const getTokens = () => {
	const telegramToken = process.env.TELEGRAM_TOKEN;
	const proxyAPI = process.env.PROXYAPI_TOKEN;
	const openaiToken = process.env.OPENAI_TOKEN;
	const PROXY_IP = process.env.PROXY_IP;
	const PROXY_PORT = process.env.PROXY_PORT;
	const PROXY_LOGIN = process.env.PROXY_LOGIN;
	const PROXY_PASSWORD = process.env.PROXY_PASSWORD;

	const proxyUrl = `socks5://${PROXY_LOGIN}:${PROXY_PASSWORD}@${PROXY_IP}:${PROXY_PORT}`;

    return {proxyUrl, telegramToken, proxyAPI, openaiToken};
};
