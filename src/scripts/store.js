/**
 * 创建数据仓库，在不存在的前提下
 * @param {String} name 数据仓库名称
 * @param {Object} config 配置项，差不多就是一个keyPath
 * @param {Object} indexes 索引列表
 */
function createObjectStoreIfNotExist(name, config, indexes = []) {
    if (!db.objectStoreNames.contains(name)) {
        const objectStore = db.createObjectStore(name, config);

        for (const key of indexes) {
            objectStore.createIndex(key, key, { unique: false });
        }
    }
}

/**
 * 往指定数据仓库内插入数据
 * @param {String} objectStoreName 
 * @param {Object} data 
 * @returns 
 */
function insertData(objectStoreName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([objectStoreName], 'readwrite');
        const objectStore = transaction.objectStore(objectStoreName);
        const request = objectStore.add(data);

        request.onsuccess = (ev) => resolve(ev);
        request.onerror = (err) => reject(err);
    });
}
function editData(objectStoreName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([objectStoreName], 'readwrite');
        const objectStore = transaction.objectStore(objectStoreName);
        const request = objectStore.put(data);

        request.onsuccess = (ev) => resolve(ev);
        request.onerror = (err) => reject(err);
    });
}

/**
 * 获取指定数据仓库内的所有数据（应该不常被调用
 * @param {String} objectStoreName 
 * @returns 
 */
function getAllData(objectStoreName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([objectStoreName], 'readonly');
        const objectStore = transaction.objectStore(objectStoreName);
        const request = objectStore.openCursor();

        let results = [];

        request.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = (err) => reject(err);
    });
}

/**
 * 按照主键获取获取，单条
 * @param {String} objectStoreName 
 * @param {Any} id 
 * @returns 
 */
function getData(objectStoreName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([objectStoreName], 'readonly');
        const objectStore = transaction.objectStore(objectStoreName);
        const request = objectStore.get(id);

        request.onsuccess = (ev) => resolve(ev.target.result);
        request.onerror = (err) => reject(err);
    });
}

/**
 * 按照索引获取数据，可能多条
 * @param {String} objectStoreName 
 * @param {String} indexName 
 * @param {Any} indexValue 
 * @returns 
 */
function getDataBy(objectStoreName, indexName, indexValue) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([objectStoreName], 'readonly');
        const store = transaction.objectStore(objectStoreName);

        const index = store.index(indexName);
        const range = IDBKeyRange.only(indexValue);

        const request = index.openCursor(range);

        let result = [];

        request.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
                result.push(cursor.value);
                cursor.continue();
            } else {
                resolve(result);
            }
        };
        request.onerror = (err) => reject(err);
    });
}

function deleteData(objectStoreName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([objectStoreName], 'readwrite');
        const objectStore = transaction.objectStore(objectStoreName);
        const request = objectStore.delete(id);

        request.onsuccess = (ev) => resolve(ev);
        request.onerror = (err) => reject(err);
    });
}
function deleteDataBy(objectStoreName, indexName, indexValue) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([objectStoreName], 'readwrite');
        const store = transaction.objectStore(objectStoreName);
        const index = store.index(indexName);
        const range = IDBKeyRange.only(indexValue);
        const request = index.openCursor(range);

        request.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = (err) => reject(err);
    });
}
function deleteDatasBy(objectStoreName, indexName, indexValues) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([objectStoreName], 'readwrite');
        const objectStore = transaction.objectStore(objectStoreName);
        const request = objectStore.openCursor();

        request.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
                const indexValue = cursor.value[indexName];
                indexValues.indexOf(indexValue) > -1 && cursor.delete();
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = (err) => reject(err);
    });
}

/**
 * 编辑章节后，保存章节编辑历史。
 * 每个章节最多保存十条历史，多余删除。
 * @param {Object} data 
 */
async function insertHistory(data = {}) {
    const historyArray = await getDataBy('history', 'cid', data.cid);
    historyArray.push(data);

    await matainHistory(historyArray);
}

function shouldMerge(ctime1, ctime2) {
    const time1 = new Date(ctime1);
    const time2 = new Date(ctime2);
    const minutes1 = time1.getMinutes();
    const minutes2 = time2.getMinutes();

    const value1 = Math.floor(minutes1 / 5);
    const value2 = Math.floor(minutes2 / 5);

    return value2 === value1;
}

/**
 * 整理历史记录，两条历史间隔不应低于 5min，历史总长度不应超过10
 * @param {Array} array 
 */
async function matainHistory(array) {
    const length = array.length;
    const lastHistory = array.pop();
    const secondLastHistory = array.pop();

    if (length > 10) {
        await deleteData('history', array[0].hid);
    }

    if (secondLastHistory && shouldMerge(lastHistory.ctime, secondLastHistory.ctime)) {
        await deleteData('history', secondLastHistory.hid);
        await insertData('history', lastHistory);
    } else {
        await insertData('history', lastHistory);
    }
}

let db = null;

const dbName = 'ginger';
const dbVersion = 2;

const stores = {
    books: ['bid', 'name', 'process', 'del'],
    rolls: ['rid', 'bid', 'name'],
    chapters: ['cid', 'rid', 'name'],
    history: ['hid', 'cid'],
    notes: ['nid', 'bid']
};

export function openStore() {
    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(dbName, dbVersion);

        request.onupgradeneeded = (ev) => {
            db = ev.target.result;
            for (const name in stores) {
                const data = stores[name];
                createObjectStoreIfNotExist(name, { keyPath: data[0] }, data.slice(1));
            }
        };
        request.onsuccess = (ev) => {
            db = ev.target.result;
            resolve(db);
        };
        request.onerror = (err) => reject(err);
    });
}

// 书籍相关
export async function getAllBooks(sortBy = 'mtime', desc = true) {
    const books = await getDataBy('books', 'del', 0);
    books.sort((a, b) => {
        const value = desc ? -1 : 1;
        if (a[sortBy] > b[sortBy]) {
            return value;
        } else {
            return -value;
        }
    });
    return books;
}
export async function getBookDetail(bid) {
    const book = await getData('books', bid);

    if (!book) {
        return undefined;
    }

    const rolls = await getDataBy('rolls', 'bid', bid);

    book.rolls = rolls;

    for (const roll of rolls) {
        roll.chapters = await getDataBy('chapters', 'rid', roll.rid);
    }

    return book;
}
export async function addBook({ name, thumb, process }) {
    const time = Date.now();
    const cid = time, rid = time, bid = time;
    const ctime = time, mtime = time;

    const book = { bid, name, thumb, process, del: 0, ctime, mtime, rolls: [rid] };
    const roll = { rid, bid, name: '第 1 卷', ctime, mtime, chapters: [cid] };
    const chapter = { cid, rid, name: '第 1 章', value: '', ctime, mtime };

    await insertData('chapters', chapter);
    await insertData('rolls', roll);
    await insertData('books', book);

    return book;
}
export async function editBook(bid, { name, thumb, process }) {
    const time = Date.now();
    const book = await getData('books', bid);

    book.name = name;
    book.thumb = thumb;
    book.process = process;
    book.mtime = time;

    await editData('books', book);
}
export async function deleteBook(bid) {
    const book = await getData('books', bid);
    const time = Date.now();

    book.del = 1;
    book.mtime = time;

    await editData('books', book);
}
export async function getDeletedBooks() {
    return await getDataBy('books', 'del', 1);
}
export async function undoDeleteBook(bid) {
    const book = await getData('books', bid);
    const time = Date.now();

    book.del = 0;
    book.mtime = time;

    await editData('books', book);
}

// 卷相关
export async function addRoll(bid, { name }) {
    const time = Date.now();

    const roll = {
        bid,
        rid: time,
        name,
        ctime: time,
        mtime: time,
        chapters: [time]
    };
    const chapter = {
        cid: time,
        rid: time,
        name: '第 1 章',
        value: '',
        ctime: time,
        mtime: time
    };

    const book = await getData('books', bid);

    book.rolls.push(time);
    book.mtime = time;

    await editData('books', book);
    await insertData('rolls', roll);
    await insertData('chapters', chapter);

    return Object.assign({}, roll, {
        chapters: [chapter]
    });
}
export async function editRoll(rid, { name }) {
    const time = Date.now();

    const roll = await getData('rolls', rid);
    const book = await getData('books', roll.bid);

    if (roll.name === name) {
        return;
    }

    roll.name = name;
    roll.mtime = time;

    book.mtime = time;

    await editData('rolls', roll);
    await editData('books', book);
}
export async function deleteRoll(rid) {
    const time = Date.now();

    const roll = await getData('rolls', rid);
    const book = await getData('books', roll.bid);

    book.mtime = time;

    await deleteDatasBy('history', 'cid', roll.chapters);
    await deleteDataBy('chapters', 'rid', rid);
    await deleteData('rolls', rid);

    await editData('books', book);
}

// 章节相关
export async function addChapter(rid, { name, value }) {
    const time = Date.now();

    const roll = await getData('rolls', rid);
    const book = await getData('books', roll.bid);

    const chapter = {
        cid: time,
        rid,
        name,
        value,
        ctime: time,
        mtime: time
    };

    roll.chapters.push(chapter.cid);
    roll.mtime = time;

    book.mtime = time;

    await insertData('chapters', chapter);
    await editData('rolls', roll);
    await editData('books', book);

    return chapter;
}
export async function deleteChapter(cid) {
    const time = Date.now();

    const chapter = await getData('chapters', cid);
    const roll = await getData('rolls', chapter.rid);
    const book = await getData('books', roll.bid);

    const cidIndex = roll.chapters.indexOf(cid);

    roll.chapters.splice(cidIndex, 1);
    roll.mtime = time;

    book.mtime = time;

    await editData('rolls', roll);
    await editData('books', book);

    await deleteDataBy('history', 'cid', cid);
    await deleteData('chapters', cid);
}
async function editChapter(cid, { value, name }) {
    const time = Date.now();

    const chapter = await getData('chapters', cid);
    const roll = await getData('rolls', chapter.rid);
    const book = await getData('books', roll.bid);

    value === undefined && (value = chapter.value);
    name === undefined && (name = chapter.name);

    if (chapter.name === name && chapter.value === value) {
        return;
    }

    chapter.mtime = time;
    chapter.name = name;
    chapter.value = value;

    roll.mtime = time;

    book.mtime = time;

    await editData('chapters', chapter);
    await editData('rolls', roll);
    await editData('books', book);
}
export async function editChapterValue(cid, newValue) {
    const time = Date.now();

    await editChapter(cid, { value: newValue });

    await insertHistory({
        hid: time,
        cid,
        value: newValue,
        ctime: time,
        mtime: time
    });
}
export async function editChapterName(cid, newName) {
    await editChapter(cid, { name: newName });
}

// 历史记录相关
export async function getChapterHistory(cid) {
    return await getDataBy('history', 'cid', cid);
}
export async function revertChapterHistory(cid, hid) {
    const chapter = await getData('chapters', cid);
    const history = await getData('history', hid);

    if (history.value === chapter.value) {
        return false;
    }

    const time = Date.now();
    const roll = await getData('rolls', chapter.rid);
    const book = await getData('books', roll.bid);

    chapter.value = history.value;
    chapter.mtime = time;

    roll.mtime = time;
    book.mtime = time;

    await editData('chapters', chapter);
    await editData('rolls', roll);
    await editData('books', book);

    return true;
}

// 笔记备忘相关
export async function getBookNotes(bid) {
    return await getDataBy('notes', 'bid', bid);
}
export async function addBookNote(bid, {name, value}) {
    if (!name || !value) {
        return;
    }

    const time = Date.now();
    const book = await getData('books', bid);

    if (!book) {
        return;
    }

    const note = {
        bid,
        nid: time,
        name,
        value,
        ctime: time,
        mtime: time
    };

    book.mtime = time;

    await insertData('notes', note);
    await editData('books', book);

    return note;
}
export async function editBookNote(nid, {name, value}) {
    if (!name || !value) {
        return;
    }

    const time = Date.now();
    const note = await getData('notes', nid);
    const book = note && await getData('books', note.bid);

    if (!book || (note.name === name && note.value === value)) {
        return;
    }

    note.name = name;
    note.value = value;
    note.mtime = time;

    book.mtime = time;

    await editData('notes', note);
    await editData('books', book);

    return true;
}
export async function deleteBookNote(nid) {
    const time = Date.now();
    const note = await getData('notes', nid);
    const book = note && await getData('books', note.bid);

    if (!book) {
        return;
    }
    book.mtime = time;

    await editData('books', book);
    await deleteData('notes', nid);
}