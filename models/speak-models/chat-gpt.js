import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getTokens } from '../../helpers/tokens.js';

const { proxyAPI, proxyUrl } = getTokens();

const PROXY_API_URL = 'https://api.proxyapi.ru/openai/v1'; // URL ProxyAPI

/**
 * Генерация текста через ProxyAPI
 * @param {object} ctx - Контекст Telegraf
 * @param {string} userId - Идентификатор пользователя
 */
export const chatGptModel = async (ctx, userId) => {
    try {
        // Создаём SOCKS5 прокси агент
        const proxyAgent = new SocksProxyAgent(proxyUrl);

        const response = await axios.post(
            `${PROXY_API_URL}/chat/completions`,
            {
                model: "gpt-4o-mini", // Модель GPT-4
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: ctx.message.text },
                ],
            },
            {
                headers: {
                    'Authorization': `Bearer ${proxyAPI}`,
                },
                httpAgent: proxyAgent, // Используем SOCKS5 прокси для HTTP
                httpsAgent: proxyAgent, // Используем SOCKS5 прокси для HTTPS
            }
        );

        const answer = response.data.choices[0]?.message?.content || '';

        await ctx.replyWithMarkdown(answer);
    } catch (error) {
        console.error('Error:', error);
        await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
    }
};