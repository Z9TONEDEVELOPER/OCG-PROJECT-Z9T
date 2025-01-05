import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getTokens } from '../../helpers/tokens.js';

const { proxyAPI, proxyUrl } = getTokens();

const PROXY_API_URL = 'https://api.proxyapi.ru/openai/v1'; // URL ProxyAPI

/**
 * Генерация изображения через ProxyAPI
 * @param {string} prompt - Текстовый запрос для генерации изображения
 * @param {string} userId - Идентификатор пользователя
 * @returns {string} - URL сгенерированного изображения
 */
export const generateImage = async (prompt, userId) => {
    try {
        // Создаём SOCKS5 прокси агент
        const proxyAgent = new SocksProxyAgent(proxyUrl);

        const response = await axios.post(
            `${PROXY_API_URL}/images/generations`,
            {
                model: "dall-e-2", // Модель DALL·E 2
                prompt: prompt,
                n: 1, // Количество изображений
                size: "1024x1024", // Размер изображения
            },
            {
                headers: {
                    'Authorization': `Bearer ${proxyAPI}`,
                },
                httpAgent: proxyAgent, // Используем SOCKS5 прокси для HTTP
                httpsAgent: proxyAgent, // Используем SOCKS5 прокси для HTTPS
            }
        );

        return response.data.data[0].url; // URL изображения
    } catch (error) {
        console.error('Error generating image:', error);
        throw new Error('Не удалось сгенерировать изображение. Пожалуйста, попробуйте позже.');
    }
};