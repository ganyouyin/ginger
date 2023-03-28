<script setup>
import { ref, computed } from 'vue';

import { formatDate } from '../scripts/tool.js';
import { PROCESS } from '../scripts/const.js';

const props = defineProps(['books', 'type', 'dateFormat']);
const emit = defineEmits(['click', 'dblclick'])

const selectedBook = ref(null);

const displayBooks = computed(() => {
    const value = props.books;

    let array = [];

    for (const one of value) {
        const thumb = one.thumb;
        const url = thumb ? URL.createObjectURL(thumb) : null;

        array.push({
            bid: one.bid,
            name: one.name,
            thumb: url,
            mtime: formatDate(one.mtime || one.bid, props.dateFormat||'Y年M月D日'),
            process: PROCESS[one.process]
        });
    }
    return array;
});

function onClickBook(book) {
    selectedBook.value = book.bid;

    emit('click', book);
}

function onDblClickBook(book) {
    emit('dblclick', book);
}

</script>

<template>
    <div
        v-for="book in displayBooks"
        :class="[
            'book',
            type || 'list',
            selectedBook === book.bid ? 'selected' : '',
        ]"
        @click="onClickBook(book)"
        @dblclick="onDblClickBook(book)"
    >
        <slot name="thumb" :book="book">
            <img v-if="book.thumb" :src="book.thumb" />
            <img v-else src="../assets/defaultThumb.webp" />
        </slot>
        <div class="info">
            <slot name="info" :book="book">
                <span class="name">{{ book.name }}</span>
                <span class="mtime">{{ book.mtime }}/</span>
                <span class="process">{{ book.process }}</span>
            </slot>
        </div>
        <div class="operates" @click.stop>
            <slot name="operate" :book="book"></slot>
        </div>
        <slot name="extras" :book="book"></slot>
    </div>
</template>

<style scoped>
.book.card {
    display: inline-block;
    box-shadow: 0px 0px 12px rgba(0, 0, 0, 0.12);
    margin: 2rem;
    width: 11rem;
    overflow: hidden;
    border-radius: 0.2rem;
    cursor: pointer;
    text-align: left;
}
.book.card img {
    width: 100%;
    height: 12rem;
    display: block;
    object-fit: cover;
}

.book.card .info {
    padding: 0.6rem;
}

.book.card .name {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.book.card .operates {
    display: none;
    position: absolute;
    bottom: 0;
    right: 0;
    width: 1rem;
    background: #fff;
    padding: 0.5rem 0.8rem;
    box-sizing: content-box;
}
.book.card:hover .operates {
    display: inline;
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

.book.list {
    display: flex;
    border: 1px solid #eee;
    margin-bottom: 1rem;
    border-radius: 0.2rem;
}

.book.list img {
    width: 4rem;
    height: 5rem;
}
.book.list .info {
    padding: 1rem 0 0 1rem;
    flex: 1;
}
.book.list  .name {
    display: block;
    margin-bottom: 0.3rem;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.book.list .operates {
    position: absolute;
    top: 50%;
    right: 1rem;
    transform: translateY(-50%);
}
.book.selected {
    box-shadow: 0px 0px 12px rgba(0, 0, 0, 0.12);
    color: var(--el-color-primary);
}
</style>