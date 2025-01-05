import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getTokens } from '../../helpers/tokens.js';

const { proxyAPI, proxyUrl } = getTokens();

const PROXY_API_URL = 'https://api.proxyapi.ru/google/v1'; // URL ProxyAPI для Google Gemini

/**
 * Экранирование зарезервированных символов для MarkdownV2
 * @param {string} text - Текст для экранирования
 * @returns {string} - Экранированный текст
 */
const escapeMarkdown = (text) => {
    const reservedChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '+', '-', '=', '|', '{', '}', '.', '!'];
    let result = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Не экранируем "#", если это часть "C#"
        if (char === '#' && i > 0 && text[i - 1] === 'C') {
            result += char;
        }
        // Экранируем другие зарезервированные символы
        else if (reservedChars.includes(char)) {
            result += `\\${char}`;
        }
        // Оставляем остальные символы без изменений
        else {
            result += char;
        }
    }

    return result;
};

/**
 * Разбивает текст на части, не превышающие лимит Telegram (4096 символов)
 * @param {string} text - Текст для разбиения
 * @param {number} limit - Максимальная длина части (по умолчанию 4096)
 * @returns {string[]} - Массив частей текста
 */
const splitText = (text, limit = 4096) => {
    const parts = [];
    while (text.length > 0) {
        const part = text.slice(0, limit);
        parts.push(part);
        text = text.slice(limit);
    }
    return parts;
};

/**
 * Форматирует текст, сохраняя блоки кода
 * @param {string} text - Текст для форматирования
 * @returns {string} - Отформатированный текст
 */
const formatText = (text) => {
    const codeBlockRegex = /```[\s\S]*?```/g; // Регулярное выражение для поиска блоков кода
    let lastIndex = 0;
    let result = '';

    // Обрабатываем текст, сохраняя блоки кода
    text.replace(codeBlockRegex, (match, offset) => {
        // Экранируем текст до блока кода
        result += escapeMarkdown(text.slice(lastIndex, offset));
        // Добавляем блок кода без изменений
        result += match;
        lastIndex = offset + match.length;
        return match;
    });

    // Экранируем оставшийся текст после последнего блока кода
    result += escapeMarkdown(text.slice(lastIndex));

    return result;
};

/**
 * Генерация текста через Google Gemini через ProxyAPI
 * @param {string} message - Текстовый запрос для генерации текста
 * @param {object} ctx - Контекст Telegraf
 */
export const googleGemeni = async (message, ctx) => {
    try {
        // Создаём SOCKS5 прокси агент
        const proxyAgent = new SocksProxyAgent(proxyUrl);

        // Проверяем, что токен ProxyAPI существует
        if (!proxyAPI) {
            throw new Error('Токен ProxyAPI не найден. Проверьте .env файл.');
        }

        const response = await axios.post(
            `${PROXY_API_URL}/models/gemini-1.5-flash:generateContent`,
            {
                contents: [
                    { role: 'user', parts: [{ text: 'You are a helpful assistant.' }] },
                    { role: 'user', parts: [{ text: message }] },
                ],
            },
            {
                headers: {
                    'Authorization': `Bearer ${proxyAPI}`, // Передаём токен
                },
                httpAgent: proxyAgent, // Используем SOCKS5 прокси для HTTP
                httpsAgent: proxyAgent, // Используем SOCKS5 прокси для HTTPS
            }
        );

        const result = response.data.candidates[0].content.parts[0].text;

        // Форматируем текст, сохраняя блоки кода
        const formattedResult = formatText(result);

        // Разбиваем текст на части
        const parts = splitText(formattedResult);

        // Отправляем каждую часть по отдельности
        for (const part of parts) {
            await ctx.replyWithMarkdown(part);
        }
    } catch (error) {
        console.error('Error:', error);

        // Используем ctx.reply для отправки сообщения об ошибке
        await ctx.reply('Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже.');
    }
};