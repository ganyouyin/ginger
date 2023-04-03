<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';

import Books from '../components/Books.vue';

import { ElButton, ElRadioGroup, ElRadioButton, ElInput, ElMessage } from 'element-plus';
import { Plus, Delete, Edit, HotWater } from '@element-plus/icons-vue'

import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/radio-button/style/css';
import 'element-plus/es/components/radio-group/style/css';
import 'element-plus/es/components/row/style/css';
import 'element-plus/es/components/col/style/css';
import 'element-plus/es/components/message/style/css';

import { openStore, getAllBooks, addBook, editBook, deleteBook, getDeletedBooks, undoDeleteBook } from '../scripts/store.js';
import { formatDate, isFileEqual, getMemoryFromLS, saveMemoryToLS } from '../scripts/tool.js';
import { PROCESS } from '../scripts/const.js';

const router = useRouter();

const processes = ref(PROCESS);
const process = ref(getMemoryFromLS().process || '全部');
const books = ref(null);
const displayBooks = computed(() => {
    const pvalue = process.value;
    const pArray = processes.value;
    const pIndex = pArray.indexOf(pvalue);
    const value = books.value || [];

    let array = [];

    for (const one of value) {
        if (pIndex === -1 || one.process === pIndex) {
            array.push(one);
        }
    }
    return array;
});

watch(process, (newValue) => {
    const memory = getMemoryFromLS();
    memory.process = newValue;
    saveMemoryToLS(memory);
});

(async function () {
    await openStore();
    books.value = await getAllBooks();
})();

const bookDialogVisible = ref(false);
const bookDialogMode = ref(null);
const bookName = ref(null);
const bookThumbUrl = ref(null);
const bookThumb = ref(null);
const bookProcess = ref(null);
const bookId = ref(null);
function openAddBookDialog() {
    bookDialogMode.value = 'add';
    bookDialogVisible.value = true;

    bookName.value = '';
    bookThumbUrl.value = '';
    bookThumb.value = '';
    bookProcess.value = processes.value[0];
}
function openEditBookDialog(book) {
    const bid = book.bid;
    const oriBook = books.value.find((one) => one.bid === bid);

    bookId.value = bid;

    bookDialogMode.value = 'edit';
    bookDialogVisible.value = true;

    bookName.value = book.name;
    bookThumbUrl.value = book.thumb;
    bookThumb.value = oriBook.thumb;
    bookProcess.value = book.process;
}
function onBookThumbChange(image) {
    const allowedTypes = ['image/jpeg', 'image/png'];
    const maxSize = 1 * 1024 * 1024;

    if (allowedTypes.indexOf(image.raw.type) < 0) {
        ElMessage.error('书籍封面必须为 jpeg 或者 png 格式的图片！');
        return false;
    } else if (image.size > maxSize) {
        ElMessage.error('书籍封面的尺寸需要小于 1 MB ！');
        return false;
    }

    bookThumbUrl.value = image.url;
    bookThumb.value = image.raw;

    return true
}
async function onConfirmBookDialog() {
    if (bookDialogMode.value === 'edit') {
        await doEditBook();
    } else {
        await doAddBook();
    }
}
async function doAddBook() {
    const name = bookName.value;
    const thumb = bookThumb.value;
    const process = processes.value.indexOf(bookProcess.value);

    const book = await addBook({ name, thumb, process });

    books.value.unshift(book);
    bookDialogVisible.value = false;
}
async function doEditBook() {
    const name = bookName.value;
    const thumb = bookThumb.value;
    const process = processes.value.indexOf(bookProcess.value);

    const oriBook = books.value.find((one) => one.bid === bookId.value);

    if (oriBook &&
        oriBook.name === name &&
        isFileEqual(oriBook.thumb, thumb) &&
        oriBook.process === process) {
        bookDialogVisible.value = false;
        return;
    }

    await editBook(bookId.value, {
        name,
        thumb,
        process
    });

    oriBook.name = name;
    oriBook.thumb = thumb;
    oriBook.process = process;

    bookDialogVisible.value = false;
}

async function openDeleteBookDialog(book) {
    bookId.value = book.bid;
    try {
        await ElMessageBox.confirm(
            `确认要删除书籍《${book.name}》吗？删除后，可在书籍回收站找回。`,
            '删除确认',
            {
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                type: 'warning',
            }
        );
        await doDeleteBook();
    } catch (ex) {
        console.log(ex);
    }
}
async function doDeleteBook() {
    const oriBookIndex = books.value.findIndex((one) => one.bid === bookId.value);

    if (oriBookIndex === -1) {
        return;
    }

    await deleteBook(bookId.value);

    books.value.splice(oriBookIndex, 1);
}

function openBook(book) {
    const bid = book.bid;

    router.push(`book/${bid}`);
}

const recycleBookDialogVisible = ref(false);
const deletedBooks = ref(null);
async function openRecycleBookDialog() {
    const books = await getDeletedBooks();
    deletedBooks.value = books;
    recycleBookDialogVisible.value = true;
}
async function onClickUndoDeleteBook(book) {
    const bid = book.bid;
    const oriBookIndex = deletedBooks.value.findIndex((one) => one.bid === bid);
    const oriBook = deletedBooks.value[oriBookIndex];

    oriBook && await undoDeleteBook(bid);

    deletedBooks.value.splice(oriBookIndex, 1);
    books.value.unshift(oriBook);
}
</script>

<template>
    <el-container id="books">
        <el-header>
            <span class="title">书籍列表</span>
            <el-radio-group size="small" v-model="process">
                <el-radio-button v-for="one in processes" :label="one" />
                <el-radio-button label="全部" />
            </el-radio-group>

            <el-button
                class="float"
                type="info"
                :icon="Delete"
                round
                @click="openRecycleBookDialog"
                >书籍回收站</el-button
            >
            <el-button
                class="float"
                type="primary"
                round
                @click="openAddBookDialog"
                >添加书籍</el-button
            ></el-header
        >
        <el-main v-if="displayBooks && displayBooks.length">
            <Books :books="displayBooks" @click="openBook" type="card">
                <template #operate="operateProps">
                    <el-icon
                        class="edit-book"
                        @click="openEditBookDialog(operateProps.book)"
                        ><Edit
                    /></el-icon>

                    <el-icon
                        class="delete-book"
                        @click="openDeleteBookDialog(operateProps.book)"
                        ><Delete
                    /></el-icon>
                </template>
                <template #extras="extraProps">
                    <div
                        class="finish-tag"
                        v-if="extraProps.book.process === '已完结'"
                    >
                        已完结
                    </div>
                </template>
            </Books>
        </el-main>
        <el-main class="empty-content" v-else-if="books && books.length">
            <el-button :icon="HotWater" link
                >没有符合筛选条件的书籍哦，请重新选择。</el-button
            >
        </el-main>
        <el-main class="empty-content" v-else>
            <el-button
                type="primary"
                :icon="Plus"
                round
                @click="openAddBookDialog"
                >添加书籍</el-button
            >
        </el-main>
    </el-container>
    <el-dialog
        v-model="bookDialogVisible"
        :title="bookDialogMode === 'add' ? '添加书籍' : '编辑书籍'"
        width="30%"
    >
        <el-row :gutter="20" align="middle">
            <el-col :span="6">书籍名称</el-col>
            <el-col :span="18"
                ><el-input
                    class="w-50 m-2"
                    placeholder="请输入书籍名称（15字以内）"
                    clearable
                    v-model="bookName"
                    :maxlength="15"
            /></el-col>
        </el-row>
        <el-row :gutter="20" align="middle">
            <el-col :span="6">书籍封面</el-col>
            <el-col :span="18">
                <el-upload
                    action="#"
                    list-type="picture-card"
                    :auto-upload="false"
                    :on-change="onBookThumbChange"
                    :show-file-list="false"
                >
                    <img
                        v-if="bookThumbUrl"
                        :src="bookThumbUrl"
                        class="avatar"
                    />
                    <el-icon v-else class="avatar-uploader-icon"
                        ><Plus
                    /></el-icon> </el-upload
            ></el-col>
        </el-row>
        <el-row :gutter="20" align="middle">
            <el-col :span="6">书籍进度</el-col>
            <el-col :span="18"
                ><el-radio-group size="small" v-model="bookProcess">
                    <el-radio-button v-for="one in processes" :label="one" />
                </el-radio-group>
            </el-col>
        </el-row>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="bookDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="onConfirmBookDialog">
                    确认
                </el-button>
            </span>
        </template>
    </el-dialog>
    <el-dialog
        v-model="recycleBookDialogVisible"
        title="书籍回收站"
        width="30%"
        top="10vh"
    >
        <div class="books-wrapper" v-if="deletedBooks.length">
            <Books :books="deletedBooks" :type="'list'" date-format="Y年M月D日 h:m:s">
                <template #info="infoProps">
                    <span class="name">{{ infoProps.book.name }}</span>
                    <span class="mtime"
                        >删除于：{{ infoProps.book.mtime }}</span
                    >
                </template>
                <template #operate="operateProps">
                    <el-button
                        class="undo-delete-book"
                        @click="onClickUndoDeleteBook(operateProps.book)"
                        >恢复</el-button
                    >
                </template>
            </Books>
        </div>
        <div class="empty-content" v-else>
            <el-button :icon="HotWater" link>此处空空荡荡。</el-button>
        </div>
    </el-dialog>
</template>

<style scoped>
#books {
    width: 100%;
    background: #fff;
}
header {
    padding: 1rem 3rem;
    overflow: auto;
    border-bottom: 1px solid #eee;
}

header .title {
    font-size: 1.2rem;
    font-weight: 600;
    margin-right: 1rem;
    vertical-align: middle;
    padding: 0 1rem;
    border-right: 1px solid #eee;
}

header .el-radio-group {
    vertical-align: middle;
}
/* header  */
header .float {
    float: right;
    margin-left: 1rem;
}

.el-upload img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.empty-content {
    display: flex;
    align-items: center;
    justify-content: center;
}

.empty-content .el-icon {
    font-size: 10rem;
}
.el-row {
    margin-bottom: 1rem;
}

.el-main {
    text-align: center;
}

.book {
    display: inline-block;
    box-shadow: 0px 0px 12px rgba(0, 0, 0, 0.12);
    margin: 2rem;
    width: 11rem;
    overflow: hidden;
    border-radius: 0.2rem;
    cursor: pointer;
    text-align: left;
}
.book img {
    width: 100%;
    height: 12rem;
    display: block;
    object-fit: cover;
}

.book .wrapper {
    padding: 0.6rem;
}

.book .name {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.book .mtime,
.book .process {
    font-size: 0.5rem;
    opacity: 0.5;
    display: inline-block;
}

.book .operate {
    display: none;
    position: absolute;
    bottom: 0;
    right: 0;
    width: 1rem;
    background: #fff;
    padding: 0.5rem 0.8rem;
    box-sizing: content-box;
}
.book:hover .operate {
    display: inline;
}

.book .finish-tag {
    position: absolute;
    top: 17px;
    right: -28px;
    transform: rotate(45deg);
    background: #9a187e;
    color: #fff;
    font-size: 0.5rem;
    padding: 0.2rem 2rem;
    letter-spacing: 0.2rem;
    border: 2px solid rgba(255, 255, 255, 0.2);
}
</style>
