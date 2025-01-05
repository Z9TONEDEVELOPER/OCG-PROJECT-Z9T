import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getTokens } from '../../helpers/tokens.js';

const { proxyAPI, proxyUrl } = getTokens();

const PROXY_API_URL = 'https://api.proxyapi.ru/anthropic/v1'; // URL ProxyAPI для Claude

/**
 * Исправление незакрытых блоков кода
 * @param {string} text - Текст для проверки
 * @returns {string} - Текст с исправленными блоками кода
 */
const fixCodeBlocks = (text) => {
    const codeBlockRegex = /```[\s\S]*?```/g;
    let fixedText = text;

    // Проверяем, что все блоки кода закрыты
    const matches = text.match(codeBlockRegex);
    if (matches) {
        matches.forEach((match) => {
            if (!match.endsWith('```')) {
                fixedText += '```'; // Закрываем блок кода
            }
        });
    }

    return fixedText;
};

/**
 * Генерация текста через Claude API через ProxyAPI
 * @param {object} ctx - Контекст Telegraf
 * @param {string} prompt - Текстовый запрос для генерации текста
 */
export const claudeModel = async (ctx, prompt) => {
    try {
        // Создаём SOCKS5 прокси агент
        const proxyAgent = new SocksProxyAgent(proxyUrl);

        const response = await axios.post(
            `${PROXY_API_URL}/messages`, // Используем метод /v1/messages для Claude
            {
                model: 'claude-3-5-sonnet-20241022', // Модель Claude (можно выбрать другую, например, claude-3-sonnet)
                system: 'You are a helpful assistant. Write in Markdown format, but do not escape characters like #, -, *, etc.', // Системные инструкции
                messages: [
                    { role: 'user', content: prompt }, // Только сообщения пользователя
                ],
                max_tokens: 710, // Максимальное количество токенов в ответе
            },
            {
                headers: {
                    'Authorization': `Bearer ${proxyAPI}`,
                    'Content-Type': 'application/json',
                },
                httpAgent: proxyAgent, // Используем SOCKS5 прокси для HTTP
                httpsAgent: proxyAgent, // Используем SOCKS5 прокси для HTTPS
            }
        );

        // Логируем ответ от API для отладки
        console.log('API Response:', response.data);

        // Извлекаем текст ответа из массива content
        const answer = response.data.content[0]?.text || '';

        if (!answer) {
            throw new Error('Ответ от Claude пустой.');
        }

        // Удаляем экранирование символов, если оно есть
        const cleanAnswer = answer.replace(/\\([#\-*_`\[\](){}>+=|.!])/g, '$1');

        // Исправляем незакрытые блоки кода
        const fixedAnswer = fixCodeBlocks(cleanAnswer);

        // Отправляем ответ пользователю
        await ctx.replyWithMarkdown(fixedAnswer);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message || error);
        await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
    }
};