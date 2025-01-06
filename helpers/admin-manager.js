import fs from 'fs';
import path from 'path';

const adminFilePath = path.resolve('admin.json');

const validateAdminData = (data) => {
    if (!data.admins || !Array.isArray(data.admins)) {
        throw new Error('Некорректная структура данных: admins должен быть массивом.');
    }
    if (typeof data.maintenanceMode !== 'boolean') {
        throw new Error('Некорректная структура данных: maintenanceMode должен быть boolean.');
    }
    if (!data.generationLimits || typeof data.generationLimits !== 'object') {
        throw new Error('Некорректная структура данных: generationLimits должен быть объектом.');
    }
};

const readAdminData = () => {
    try {
        if (!fs.existsSync(adminFilePath)) {
            const initialData = {
                admins: [556348928],
                maintenanceMode: false,
                generationLimits: {
                    chatGpt: 10,
                    stableDiffusion: 5,
                    dalle: 5,
                    mistralai: 10,
                    claude: 10,
                    gemini: 10
                }
            };
            fs.writeFileSync(adminFilePath, JSON.stringify(initialData, null, 2), 'utf-8');
            return initialData;
        }

        const data = fs.readFileSync(adminFilePath, 'utf-8');
        if (!data.trim()) {
            throw new Error('Файл admin.json пуст.');
        }

        const parsedData = JSON.parse(data);
        validateAdminData(parsedData);
        return parsedData;
    } catch (error) {
        console.error('Ошибка чтения файла admin.json:', error);
        return {
            admins: [556348928],
            maintenanceMode: false,
            generationLimits: {
                chatGpt: 10,
                stableDiffusion: 5,
                dalle: 5,
                mistralai: 10,
                claude: 10,
                gemini: 10
            }
        };
    }
};

const writeAdminData = (data) => {
    try {
        fs.writeFileSync(adminFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Ошибка записи в файл admin.json:', error);
    }
};

export const isAdmin = (userId) => {
    const data = readAdminData();
    return data.admins.includes(Number(userId));
};

export const addAdmin = (userId) => {
    const data = readAdminData();
    if (!data.admins.includes(userId)) {
        data.admins.push(userId);
        writeAdminData(data);
    }
};

export const removeAdmin = (userId) => {
    const data = readAdminData();
    data.admins = data.admins.filter(id => id !== userId);
    writeAdminData(data);
};

export const toggleMaintenanceMode = (enabled) => {
    const data = readAdminData();
    data.maintenanceMode = enabled;
    writeAdminData(data);
};

export const getMaintenanceMode = () => {
    const data = readAdminData();
    return data.maintenanceMode;
};

export const getGenerationLimits = () => {
    const data = readAdminData();
    return data.generationLimits;
};

export const updateGenerationLimit = (model, limit) => {
    const data = readAdminData();
    if (data.generationLimits[model] === undefined) {
        throw new Error(`Модель ${model} не найдена в generationLimits.`);
    }
    data.generationLimits[model] = limit;
    writeAdminData(data);
};