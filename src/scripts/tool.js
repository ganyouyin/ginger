export function formatDate(time, format = 'Y年M月D日') {
    const date = new Date(time);

    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();


    return format.replace('Y', year)
        .replace('M', month)
        .replace('D', day)
        .replace('h', hours)
        .replace('m', minutes)
        .replace('s', seconds);
}

export function isFileEqual(file1, file2) {
    return file1.name === file2.name && file1.type === file2.type && file1.size === file2.size && file1.lastModified === file2.lastModified;
}


export function getMemoryFromLS() {
    const itemName = 'ginger-memory';
    const value = localStorage.getItem(itemName);

    return value ? JSON.parse(value) : {};
}

export function saveMemoryToLS(value) {
    const itemName = 'ginger-memory';

    localStorage.setItem(itemName, typeof value === 'string' ? value : JSON.stringify(value));
}