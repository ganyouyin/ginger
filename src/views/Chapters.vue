<script setup>
import { ref, nextTick, computed, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';

import Books from '../components/Books.vue';

import { ElButton, ElLoading } from 'element-plus'
import {
    Folder,
    Tickets,
    Switch,
    Delete,
    Clock,
    RefreshRight,
    Close,
    HotWater,
    ArrowLeft,
    ArrowRight
} from '@element-plus/icons-vue';

import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/loading/style/css';
import 'element-plus/es/components/message/style/css';

import {
    openStore,
    getAllBooks,
    getBookDetail,
    addRoll,
    deleteRoll,
    editRoll,
    addChapter,
    deleteChapter,
    editChapterValue,
    editChapterName,
    getChapterHistory,
    revertChapterHistory,
} from '../scripts/store.js';

import {
    formatDate,
    getMemoryFromLS,
    saveMemoryToLS
} from '../scripts/tool.js';

const router = useRouter();
const route = useRoute();
let bid = route.params.bid - 0;

const ready = ref(false);

const name = ref(null);
const thumb = ref(null);
const rolls = ref(null);

const currentChapter = ref(null);

const memory = getMemoryFromLS();

(async function () {
    onBeforeRouteLeave(() => {
        window.chapterBodyEvents = 0;

        document.body.removeEventListener('click', updateSelectionLength);
        document.body.removeEventListener('keyup', updateSelectionLength);
        document.body.removeEventListener('paste', onPaste);
    });

    await load();
})();

async function load() {
    ready.value = false;
    name.value = null;
    thumb.value = null;
    rolls.value = [];
    currentChapter.value = null;

    ElLoading.service({
        lock: true,
        text: 'Loading',
        background: '#fff',
    });

    await openStore();

    const bookDetail = await getBookDetail(bid);

    ready.value = true;
    ElLoading.service().close();

    if (!bookDetail) {
        return;
    }

    console.log(bookDetail);

    name.value = bookDetail.name;
    thumb.value = bookDetail.thumb && URL.createObjectURL(bookDetail.thumb);
    rolls.value = bookDetail.rolls;

    await nextTick();

    if (!window.chapterBodyEvents) {
        window.chapterBodyEvents = 1;// 避免本地开发时，由于hmr的存在，事件被多次注册，有更好的办法吗？
        document.body.addEventListener('click', updateSelectionLength);
        document.body.addEventListener('keyup', updateSelectionLength);
        document.body.addEventListener('paste', onPaste);
    }

    openDefaultChapter();
}

/**
 * 一系列工具函数
 */
function findChapterByCid(cid) {
    for (let roll of rolls.value) {
        for (let chapter of roll.chapters) {
            if (chapter.cid === cid) {
                return chapter;
            }
        }
    }
}
function findRollByCid(cid) {
    for (let roll of rolls.value) {
        for (let chapter of roll.chapters) {
            if (chapter.cid === cid) {
                return roll;
            }
        }
    }
}
function getBookContentFromHTML() {
    const el = document.body.getElementsByClassName('book-content')[0];
    return el.innerHTML;
}
function setBookContentOnHTML(value) {
    const el = document.body.getElementsByClassName('book-content')[0];
    el.innerHTML = value;
}
function getEditorScroll() {
    const el = document.body.getElementsByClassName('book-content')[0];
    return el.scrollTop;
}
function setEditorScroll(value) {
    const el = document.body.getElementsByClassName('book-content')[0];
    el.scrollTop = value;
}
function isBookContentEl(target) {
    let node = target;
    while (node) {
        if (node.classList && node.classList.contains('book-content')) {
            return true;
        }
        node = node.parentNode;
    }

    return false;
}
function getChapterValueLength(value) {
    const el = document.createElement('div');
    el.innerHTML = value;

    const innerText = el.innerText;
    return innerText.replace(/[\n\s]/g, '').length;
}

/**
 * 进入页面时调用，打开默认章节，默认章节的定义：上一次打开的章节，或者第一卷的第一个章节
 */
function getDefaultChapter() {
    if (memory.chapter && memory.chapter[bid]) {
        return memory.chapter[bid];
    }

    const data = rolls.value;

    if (data && data[0] && data[0].chapters && data[0].chapters[0]) {
        return data[0].chapters[0].cid;
    }
}
async function openDefaultChapter() {
    const defaultCid = getDefaultChapter();

    if (!defaultCid) {
        return;
    }

    await openChapter(defaultCid);

    selectChapter(defaultCid);
    expandRoll(findRollByCid(defaultCid).rid);
}

/**
 * 工具函数，打开章节，包括内容有：展示章节内容、设置章节滚动，以及，将该次打开的章节id，保存至localStotage
 * 额外操作：如果当前有打开的章节，先保存其内容
 * @param {Number} cid 
 */
async function openChapter(cid) {
    if (currentChapter.value) {
        await doSaveChapterValue();
    }

    const roll = findRollByCid(cid);
    const chapter = findChapterByCid(cid);

    if (!roll) {
        return;
    }

    currentChapter.value = chapter;
    currentChapterValue.value = chapter.value;

    setBookContentOnHTML(chapter.value);

    memory.scroll && memory.scroll[cid] && setEditorScroll(memory.scroll[cid]);

    Object.prototype.toString.call(memory.chapter) !== '[object Object]' && (memory.chapter = {});
    memory.chapter[bid] !== cid && (memory.chapter[bid] = cid, saveMemoryToLS(memory));
}

/**
 * 切换书籍
 */
const switchBookDialogVisible = ref(false);
const books = ref(null);
const selectedBook = ref(null);
watch(() => route.params.bid, async (newBid) => {
    bid = newBid - 0;
    await load();
    switchBookDialogVisible.value = false;
});
async function openSwitchBookDialog() {
    books.value = await getAllBooks();

    switchBookDialogVisible.value = true;
}
function onSelectBook(book) {
    selectedBook.value = book;
}
function onConfirmSwitchBookDialog() {
    const book = selectedBook.value;

    if (book.bid === bid) {
        switchBookDialogVisible.value = false;
        return;
    }

    router.push(`/book/${book.bid}`);
}

/**
 * 用于展示的章节列表数据
 */
const displayData = computed(() => {
    let data = [];

    for (let roll of rolls.value) {
        const temp = {
            rid: roll.rid,
            id: `roll-${roll.rid}`,
            name: roll.name,
            chapters: []
        };

        for (let chapter of roll.chapters) {
            const temp2 = {
                cid: chapter.cid,
                id: `chapter-${chapter.cid}`,
                name: chapter.name
            };

            temp.chapters.unshift(temp2);
        }
        data.unshift(temp);
    }

    return data;
});

/**
 * 对章节列表菜单的相关操作，包括设置默认打开卷，设置默认选中章节，以及函数调用展开卷。
 */
const menu = ref();
const defaultExpandRoll = ref(null);
const defaultCheckedChapter = ref(null);
function selectChapter(cid) {
    defaultCheckedChapter.value = `chapter-${cid}`;
}
function expandRoll(rid) {
    defaultExpandRoll.value || (defaultExpandRoll.value = []);
    defaultExpandRoll.value.push(`roll-${rid}`);
}
function openMenu(rid) {
    const $menu = menu.value;
    $menu && $menu.open(`roll-${rid}`);
}

/**
 * 添加卷
 */
async function doAddRoll() {
    const roll = await addRoll(bid - 0, { name: `第 ${rolls.value.length + 1} 卷` });
    const chapter = roll.chapters[0];

    rolls.value.push(roll);

    await openChapter(chapter.cid);

    await nextTick();

    selectChapter(chapter.cid);
    openMenu(roll.rid);
}

/**
 * 添加章节
 */
async function doAddChapter() {
    const chapter = currentChapter.value;
    const roll = findRollByCid(chapter.cid);
    const value = await addChapter(roll.rid, { name: `第 ${roll.chapters.length + 1} 章`, value: '' });

    roll.chapters.push(value);

    await openChapter(value.cid);

    selectChapter(value.cid);
}

/**
 * 修改卷名，包括显示修改输入框，回车确认修改等逻辑
 */
const editingRid = ref(null);
const editingRName = ref(null);
const editingRNameInput = ref();
async function displayEditRollNameInput(rid) {
    const roll = rolls.value.find((roll) => roll.rid === rid);

    editingRid.value = rid;
    editingRName.value = roll.name;

    await nextTick();

    const $input = editingRNameInput.value && editingRNameInput.value[0];

    $input && $input.focus();
}
async function startEditRollName() {
    const roll = rolls.value.find((roll) => roll.rid === editingRid.value);
    const newName = editingRName.value;

    if (roll.name !== newName && newName) {
        await editRoll(roll.rid, { name: newName });
        roll.name = newName;
    }

    editingRid.value = null;
    editingRName.value = null;
}
function onKeyEnterOnEditRollNameInput() {
    const $input = editingRNameInput.value && editingRNameInput.value[0];

    $input && $input.blur();
}

/**
 * 修改章节名，包括显示修改输入框，回车确认修改等逻辑
 */
const editingCid = ref(null);
const editingCName = ref(null);
const editingCNameInput = ref();
async function displayEditChapterNameInput(cid) {
    editingCid.value = cid;
    editingCName.value = currentChapter.value.name;

    await nextTick();

    const $input = editingCNameInput.value && editingCNameInput.value[0];

    $input && $input.focus();
}
async function startEditChapterName() {
    const chapter = currentChapter.value;
    const newName = editingCName.value;

    if (chapter.name !== newName && newName) {
        await editChapterName(chapter.cid, newName);
        chapter.name = newName;
    }

    editingCid.value = null;
    editingCName.value = null;
}
function onKeyEnterOnEditChapterNameInput() {
    const $input = editingCNameInput.value && editingCNameInput.value[0];

    $input && $input.blur()
}

/**
 * 删除卷，包括显示确认删除对话框，确认删除等逻辑
 */
async function openDeleteRollDialog(roll) {
    try {
        await ElMessageBox.confirm(
            `确认删除${roll.name}吗？删除后，卷不可找回。`,
            '删除卷',
            {
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                type: 'warning',
            }
        );

        await doDeleteRoll(roll);
    } catch (ex) {
        console.log(ex);
    }
}
async function doDeleteRoll({ rid }) {
    await deleteRoll(rid);

    const index = rolls.value.findIndex((roll) => roll.rid === rid);

    let openCid;

    for (const roll of rolls.value) {
        if (roll.rid !== rid && roll.chapters.length) {
            openCid = roll.chapters[0].cid;
        }
    }

    rolls.value.splice(index, 1);

    if (openCid) {
        await openChapter(openCid);
        selectChapter(openCid);
    } else {
        // 没有可用章节，清空当前页面
        Object.prototype.toString.call(memory.chapter) === '[object Object]' && (memory.chapter[bid] = null);
        saveMemoryToLS(memory);
    }
}

/**
 * 删除章节，包括显示确认删除对话框，确认删除等逻辑
 */
async function openDeleteChapterDialog(chapter, roll) {
    try {
        await ElMessageBox.confirm(
            `确认删除${roll.name}${chapter.name}吗？删除后，章节不可找回。`,
            '删除章节',
            {
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                type: 'warning',
            }
        );

        await doDeleteChapter(chapter);
    } catch (ex) {
        console.log(ex);
    }
}
async function doDeleteChapter({ cid }) {
    await deleteChapter(cid);

    const roll = findRollByCid(cid);
    const index = roll.chapters.findIndex((one) => one.cid === cid);

    let openCid;

    if (currentChapter.value.cid === cid) {
        if (roll.chapters[index + 1]) {
            openCid = roll.chapters[index + 1].cid;
        } else if (roll.chapters[index - 1]) {
            openCid = roll.chapters[index - 1].cid;
        } else {
            for (let one of rolls.value) {
                if (one.rid === roll.rid) {
                    continue;
                }
                if (one.chapters && one.chapters.length) {
                    openCid = one.chapters[0].cid;
                    break;
                }
            }
        }
    }

    roll.chapters.splice(index, 1);

    if (openCid) {
        await openChapter(openCid);
        selectChapter(openCid);
    } else {
        // 没有可用章节，清空当前页面
        Object.prototype.toString.call(memory.chapter) === '[object Object]' && (memory.chapter[bid] = null);
        saveMemoryToLS(memory);
    }
}

/**
 * 章节历史，展示章节历史的对话框，以及恢复到某个版本的功能
 */
const historyDialogVisible = ref(false);
const currentHistoryCid = ref(null);
const historyArray = ref(null);
const selectedHid = ref(null);
const selectedHvalue = ref(null);
async function openHistoryDialog(chapter) {
    const cid = chapter.cid;
    const result = await getChapterHistory(cid);

    historyArray.value = result.reverse();
    historyDialogVisible.value = true;
    currentHistoryCid.value = cid;

    selectHistory(result[0]);
}
function selectHistory(history) {
    if (history) {
        selectedHid.value = history.hid;
        selectedHvalue.value = history.value;
    } else {
        selectedHid.value = null;
        selectedHvalue.value = null;
    }
}
async function revertHistory() {
    const cid = currentHistoryCid.value;
    const hid = selectedHid.value;
    const hvalue = selectedHvalue.value;

    const chapter = findChapterByCid(cid);

    if (!chapter) {
        return;
    }

    if (chapter.value === hvalue) {
        return;
    }

    await revertChapterHistory(cid, hid);

    chapter.value = hvalue;

    if (currentChapter.value.cid === cid) {
        setBookContentOnHTML(hvalue);
    }

    ElMessage({
        showClose: false,
        message: '恢复成功',
        type: 'info'
    });
}
/**
 * 文章编辑区有关的一系列操作
 */

/**
* 当在文件编辑区按下 (meta||ctrl)&&S 时，保存文章内容
*/
async function onKeyDownInBookContent(ev) {
    if (ev.metaKey || ev.ctrlKey) {
        if (ev.which === 83) {
            ev.preventDefault();
            const result = await doSaveChapterValue();

            result && ElMessage({
                showClose: false,
                message: '保存成功',
                type: 'success'
            });
        } else if (ev.which === 66) {
            toggleSidebar();
        }
    }
}
async function doSaveChapterValue() {
    const newValue = getBookContentFromHTML();
    const chapter = currentChapter.value;
    const { cid, value } = chapter;

    if (newValue === value) {
        return false;
    }

    chapter.value = newValue;

    await editChapterValue(cid, newValue);

    return true;
}

/**
 * 统计全文字数并展示
 */
const bookContentTotalLength = computed(() => {
    let total = 0;
    for (let roll of rolls.value) {
        for (let chapter of roll.chapters) {
            if (currentChapter.value && chapter.cid === currentChapter.value.cid) {
                total += currentChapterValueLength.value;
            } else {
                total += getChapterValueLength(chapter.value);
            }
        }
    }
    return total;
});

/**
 * 当在文件编辑区编辑章节内容时，实时更新本章字数和章节总字数
 */
const currentChapterValue = ref(null);
const currentChapterValueLength = computed(() => {
    return getChapterValueLength(currentChapterValue.value);
});
function onEditBookContent() {
    const value = getBookContentFromHTML();

    currentChapterValue.value = value;
}

/**
 * 当在编辑区进行粘贴行为时，预处理粘贴内容
 */
function onPaste(ev) {
    const event = ev.originalEvent || ev;
    const target = event.target;

    let text;

    if (!isBookContentEl(target)) {
        return;
    }
    event.stopPropagation();
    event.preventDefault();

    if (event.clipboardData && event.clipboardData.getData) {
        text = event.clipboardData.getData('text/plain');
    } else if (window.clipboardData && window.clipboardData.getData) {
        text = window.clipboardData.getData('Text');
    }

    text = text.replace(/\r/g, '');

    if (document.queryCommandSupported('insertText')) {
        document.execCommand('insertText', false, text);
    } else {
        document.execCommand('paste', false, text);
    }
}

/**
 * 编辑区内容被选中时，更新提示下方选中文字个数提示
 */
const selectionLength = ref(0);
function updateSelectionLength() {
    const selection = document.getSelection();
    const focusNode = selection.focusNode;

    console.log(focusNode);
    const value = isBookContentEl(focusNode) ? selection.toString() : '';

    selectionLength.value = getChapterValueLength(value);
}

/**
 * 显示或隐藏侧边栏
 */
const displaySidebar = ref(memory.displaySidebar === undefined ? true : memory.displaySidebar);
function toggleSidebar() {
    displaySidebar.value = !displaySidebar.value;

    memory.displaySidebar = displaySidebar.value;

    saveMemoryToLS(memory);
}
/**
 * 当在文件编辑区滚动页面时，在localStotage中保存滚动位置，方便下次查看
 */
function onEditorScroll() {
    let scroll = getEditorScroll();

    if (!currentChapter.value) {
        return;
    }

    memory.scroll || (memory.scroll = {});
    memory.scroll[currentChapter.value.cid] = scroll;

    saveMemoryToLS(memory);
}
</script>

<template>
    <el-container id="chapters" v-if="name">
        <el-aside width="23rem" v-show="displaySidebar">
            <el-card
                class="box-card side-bar"
                shadow="never"
                :body-style="{ padding: 0, flex: 1, overflow: 'auto' }"
            >
                <template #header>
                    <div class="card-header">
                        <img class="thumb" v-if="thumb" :src="thumb" />
                        <img
                            class="thumb"
                            v-else
                            src="../assets/defaultThumb.webp"
                        />
                        <div class="wrapper">
                            <span class="name">{{ name }}</span>
                            <el-icon
                                class="switch-book"
                                @click="openSwitchBookDialog"
                                ><Switch
                            /></el-icon>
                            <div class="operate">
                                <el-button
                                    class="add-roll"
                                    size="small"
                                    @click="doAddRoll"
                                    >新建卷</el-button
                                >
                                <el-button
                                    class="add-chapter"
                                    size="small"
                                    @click="doAddChapter"
                                    >新建章</el-button
                                >
                            </div>
                        </div>
                    </div>
                </template>
                <el-menu
                    ref="menu"
                    :default-openeds="defaultExpandRoll"
                    :default-active="defaultCheckedChapter"
                >
                    <el-sub-menu
                        v-for="roll in displayData"
                        :index="roll.id"
                        :key="roll.rid"
                    >
                        <template #title>
                            <el-icon><Folder /></el-icon>
                            <el-input
                                ref="editingRNameInput"
                                v-if="editingRid === roll.rid"
                                v-model="editingRName"
                                @blur="startEditRollName"
                                @keydown.enter.native="
                                    onKeyEnterOnEditRollNameInput
                                "
                                @click.native.stop
                                autofocus="true"
                                :show-word-limit="true"
                                :maxlength="20"
                                :minlength="1"
                                class="editing-name-input"
                            />
                            <span
                                v-else
                                @dblclick="displayEditRollNameInput(roll.rid)"
                                >{{ roll.name }}</span
                            >
                            <div class="operate">
                                <el-icon
                                    @click.stop="openDeleteRollDialog(roll)"
                                >
                                    <Delete />
                                </el-icon>
                            </div>
                        </template>
                        <el-menu-item
                            v-for="(chapter, index) in roll.chapters"
                            :index="chapter.id"
                            @click="openChapter(chapter.cid)"
                            @dblclick.prevent="
                                displayEditChapterNameInput(chapter.cid)
                            "
                        >
                            <el-icon><Tickets /></el-icon>
                            <el-input
                                ref="editingCNameInput"
                                v-if="editingCid === chapter.cid"
                                v-model="editingCName"
                                @blur="startEditChapterName"
                                @keydown.enter.native="
                                    onKeyEnterOnEditChapterNameInput
                                "
                                autofocus="true"
                                :show-word-limit="true"
                                :maxlength="20"
                                :minlength="1"
                                class="editing-name-input"
                            />
                            <span v-else>{{ chapter.name }}</span>
                            <div class="operate">
                                <el-icon
                                    @click.stop="openHistoryDialog(chapter)"
                                    ><Clock
                                /></el-icon>
                                <el-icon
                                    @click.stop="
                                        openDeleteChapterDialog(chapter, roll)
                                    "
                                    ><Delete
                                /></el-icon>
                            </div>
                        </el-menu-item>
                    </el-sub-menu>
                </el-menu>
            </el-card>
        </el-aside>
        <el-main class="content-wrapper">
            <span
                class="current-chapter-name"
                v-if="!displaySidebar && currentChapter"
                >{{ currentChapter.name }}</span
            >
            <div
                class="book-content"
                contenteditable="true"
                @keydown="onKeyDownInBookContent"
                @keyup="onEditBookContent"
                @scroll="onEditorScroll"
            ></div>
            <div class="book-content-toolbar">
                <el-button
                    plain
                    circle
                    :icon="displaySidebar ? ArrowLeft : ArrowRight"
                    @click="toggleSidebar"
                    class="toggle-sidebar"
                ></el-button>
                <el-tag
                    round
                    size="default"
                    effect="plain"
                    type="info"
                    class="book-content-length-counter"
                >
                    <span style="display: inline-block; min-width: 8rem"
                        >全文字数：{{ bookContentTotalLength }}字</span
                    >
                    <span style="display: inline-block; min-width: 8rem"
                        >本章字数：<template v-if="selectionLength"
                            ><span style="color: orange">{{
                                selectionLength
                            }}</span>
                            / </template
                        >{{ currentChapterValueLength }}字</span
                    >
                </el-tag>
            </div>
        </el-main>
    </el-container>
    <div v-else-if="ready" class="no-book-text">
        <span>文章ID有误，找不到对应书籍，请详细确认！</span>
        <el-button
            type="primary"
            round
            :icon="Switch"
            @click="openSwitchBookDialog"
            >切换书籍</el-button
        >
    </div>
    <el-dialog
        v-model="switchBookDialogVisible"
        title="切换打开书籍"
        width="30%"
        top="10vh"
        class="switch-book-dialog"
    >
        <div class="books-wrapper" v-if="books.length">
            <Books
                :books="books"
                :type="'list'"
                date-format="Y年M月D日 h:m:s"
                @click="onSelectBook"
                @dblclick="onConfirmSwitchBookDialog"
            ></Books>
        </div>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="switchBookDialogVisible = false"
                    >取消</el-button
                >
                <el-button type="primary" @click="onConfirmSwitchBookDialog">
                    确认
                </el-button>
            </span>
        </template>
    </el-dialog>
    <el-dialog
        v-model="historyDialogVisible"
        width="60%"
        top="10vh"
        class="history-dialog"
    >
        <template v-if="historyArray && historyArray.length">
            <div class="list">
                <div class="title">版本列表</div>
                <ul class="content">
                    <li
                        v-for="(one, index) in historyArray"
                        :class="one.hid === selectedHid ? 'selected' : ''"
                        @click="selectHistory(one)"
                    >
                        {{ formatDate(one.ctime, "Y年M月D日 h:m:s") }}
                    </li>
                </ul>
            </div>
            <div class="content-wrapper">
                <div class="title">
                    <span>版本列表</span>
                    <el-icon
                        class="hide-dialog"
                        @click="historyDialogVisible = false"
                        ><Close
                    /></el-icon>
                </div>
                <div class="content" v-html="selectedHvalue"></div>
                <el-button
                    class="revert-button"
                    link
                    :icon="RefreshRight"
                    @click="revertHistory"
                    >恢复为该版本</el-button
                >
            </div>
        </template>
        <template v-else>
            <div class="empty-context">
                <el-icon><HotWater /></el-icon>
                暂无编辑历史，请确认。
            </div>
            <el-icon class="hide-dialog" @click="historyDialogVisible = false"
                ><Close
            /></el-icon>
        </template>
    </el-dialog>
</template>


<style scoped>
.no-book-text {
    margin: 0 auto;
    vertical-align: middle;
    top: 50%;
    text-align: center;
}
.no-book-text span {
    display: block;
    margin-bottom: 1rem;
}
#chapters {
    background: #dbdbdb;
    padding: 1rem;
    justify-content: center;
}
.side-bar {
    display: flex;
    flex-direction: column;
    height: 100%;
    margin-right: 1rem;
}

.card-header .thumb {
    height: 5rem;
    border-radius: 0.1rem;
    float: left;
}
.card-header .wrapper {
    float: left;
    margin-left: 1rem;
}

.card-header .name {
    font-size: 1.2rem;
}

.switch-book {
    margin-left: 0.5rem;
}
.card-header .operate {
    margin-top: 1rem;
}

.el-sub-menu .operate {
    display: none;
    position: absolute;
    top: 0;
    right: 2rem;
}

.el-sub-menu__title:hover > .operate {
    display: inline-block;
}

.editing-name-input {
    width: 14rem;
}

.el-menu-item .editing-name-input {
    width: 12rem;
}

.el-sub-menu__title > span {
    width: 100%;
}

.el-menu-item .operate {
    right: 0.6rem;
}
.el-menu-item:hover > .operate {
    display: inline-block;
}
.content-wrapper {
    overflow: hidden;
    max-width: 64rem;
    padding: 0;
    border-radius: 0.2rem;
}

.current-chapter-name {
    position: absolute;
    top: 1rem;
    left: 1rem;
    padding: 0.2rem 1rem;
    border-radius: 2rem;
    z-index: 1;
    color: #333;
    background: var(--el-color-primary-light-10);
    opacity: 0.7;
    font-size: 12px;
}
.book-content {
    height: 100%;
    overflow: auto;
    padding: 5rem;
    font-size: large;
    font-family: "PingFang SC";
    outline: none;
    box-sizing: border-box;
    line-height: 2;
    background: var(--el-color-primary-light-10);
    color: #333;
}
.book-content-toolbar {
    position: absolute;
    bottom: 0;
    width: 100%;
    text-align: center;
    line-height: 3;
}
.toggle-sidebar {
    position: absolute;
    left: 0.5rem;
    bottom: 0.5rem;
}
.book-content-length-counter {
    box-shadow: 0px 0px 2px 1px rgb(0 0 0 / 10%);
    border: none;
}

.history-dialog .empty-context {
    width: 100%;
    text-align: center;
    top: 50%;
    position: absolute;
}

.history-dialog .hide-dialog {
    position: absolute;
    top: 1rem;
    right: 1rem;
    cursor: pointer;
}

.history-dialog .list {
    display: flex;
    flex-direction: column;
    width: 15rem;
    border-right: 1px solid #eee;
}

.history-dialog .list .content {
    list-style: none;
    padding: 0;
}
.history-dialog .list .content li {
    padding: 0.8rem 1rem;
    cursor: pointer;
}
.history-dialog .list .content li.selected {
    color: var(--el-color-primary);
    background: #fafafa;
}
.history-dialog .content-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
}

/* .history-dialog .content-wrapper .title .el-icon {
    float: right;
    cursor: pointer;
} */

.history-dialog .content-wrapper .content {
    padding: 1rem;
    background: var(--el-color-primary-light-10);
    font-size: 1rem;
}

.history-dialog .revert-button {
    position: absolute;
    top: 5rem;
    right: 1rem;
    background: var(--el-color-primary-light-10) !important;
    padding: 0.5rem;
}

.history-dialog .title {
    font-size: 1rem;
    padding: 1rem;
}

.history-dialog .content {
    flex: 1;
    overflow: auto;
}
</style>


<style>
.history-dialog,
.switch-book-dialog {
    display: flex;
    flex-direction: column;
    max-height: 80vh;
    overflow: hidden;
}
.history-dialog .el-dialog__body,
.switch-book-dialog .el-dialog__body {
    flex: 1;
}

.switch-book-dialog .el-dialog__body {
    overflow: auto;
}

.history-dialog {
    min-height: 80vh;
}

.history-dialog .el-dialog__header {
    display: none;
}
.history-dialog .el-dialog__body {
    display: flex;
    padding: 0;
    overflow: hidden;
    border-top: 1px solid #eee;
}
</style>