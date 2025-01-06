import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const stableDiffusionApiKey = process.env.STABLE_DIFFUSION_API_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function stableDefusion(prompt, ctx) {
    const imagePath = path.join(__dirname, 'images', 'generated_image.png');
    console.log(stableDiffusionApiKey, imagePath);

    try {
        // Уведомляем пользователя о начале генерации
        await ctx.reply('Generating image...');

        // Создаём директорию для изображений, если её нет
        if (!fs.existsSync(path.dirname(imagePath))) {
            fs.mkdirSync(path.dirname(imagePath), { recursive: true });
        }

        // Отправляем запрос к API Stable Diffusion
        const response = await axios.post(
            'https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image',
            {
                text_prompts: [{ text: prompt }],
                cfg_scale: 7,
                height: 512,
                width: 512,
                steps: 30,
                samples: 1,
            },
            {
                headers: {
                    Authorization: `Bearer ${stableDiffusionApiKey}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            }
        );
        try {
            if (!fs.existsSync(imagePath)) {
                throw new Error('Файл изображения не найден.');
            }
            await ctx.replyWithPhoto({ source: fs.createReadStream(imagePath) });
            ctx.session.generationCounts.stableDiffusion += 1;
        } catch (error) {
            console.error('Error generating image:', error);
            await ctx.reply('Произошла ошибка при генерации изображения. Пожалуйста, попробуйте позже.');
        }
        // Получаем изображение в формате base64
        const imageBase64 = response.data.artifacts[0].base64;
        const imageBuffer = Buffer.from(imageBase64, 'base64');

        // Сохраняем изображение на диск
        await fs.promises.writeFile(imagePath, imageBuffer);

        // Проверяем, что файл существует
        if (!fs.existsSync(imagePath)) {
            throw new Error('Failed to save the image.');
        }

        // Возвращаем путь к изображению
        return imagePath;
    } catch (error) {
        console.error('Error:', error.response?.data || error.message || error);

        // Уведомляем пользователя об ошибке
        await ctx.reply(
            'There was an error when generating an image. Please try again later.'
        );

        // Возвращаем null в случае ошибки
        return null;
    }
}