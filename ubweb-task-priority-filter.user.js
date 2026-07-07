// ==UserScript==
// @name         UBWEB 任务备注优先级
// @namespace    https://github.com/A-hongchen/ubweb-task-priority-filter
// @version      1.0.1
// @description  仅读取当前用户认领任务的优先级，并校正备注开头的优先级标记
// @author       A-hongchen
// @license      MIT
// @match        *://task.ubweb.best/*
// @include      *://task.ubweb.best*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var CONTROL_ID = 'ubweb-task-priority-control';
    var STYLE_ID = 'ubweb-task-priority-style';
    var running = false;

    var assigneeHeaders = ['认领', '认领人', '领取人', '负责人', '处理人', '执行人', '认领用户', '当前认领人'];

    function normalizeText(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    function containsAny(text, words) {
        var value = normalizeText(text).toLowerCase();
        for (var i = 0; i < words.length; i += 1) {
            if (value.indexOf(String(words[i]).toLowerCase()) !== -1) return true;
        }
        return false;
    }

    function isVisible(element) {
        if (!element || !document.body || !document.body.contains(element)) return false;
        var style = window.getComputedStyle(element);
        var rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }

    function closest(element, selector) {
        while (element && element.nodeType === 1) {
            if (element.matches && element.matches(selector)) return element;
            element = element.parentElement;
        }
        return null;
    }

    function getDirectText(element) {
        var clone = element.cloneNode(true);
        while (clone.firstElementChild) clone.removeChild(clone.firstElementChild);
        return normalizeText(clone.textContent);
    }

    function isLikelyUsername(text) {
        var value = normalizeText(text);
        if (!value || value === '退出登录') return false;
        if (value.indexOf(' ') !== -1) return false;
        return /^[A-Za-z0-9_.@-]{2,64}$/.test(value);
    }

    function detectCurrentUsername() {
        var nodes = document.querySelectorAll('button, a, span, div');
        var logoutEl = null;
        var i;

        for (i = 0; i < nodes.length; i += 1) {
            if (normalizeText(nodes[i].textContent) === '退出登录') {
                logoutEl = nodes[i];
                break;
            }
        }

        if (logoutEl && logoutEl.parentElement) {
            var siblings = logoutEl.parentElement.children;
            var logoutIndex = -1;
            for (i = 0; i < siblings.length; i += 1) {
                if (siblings[i] === logoutEl) logoutIndex = i;
            }
            for (i = logoutIndex - 1; i >= 0; i -= 1) {
                var text = getDirectText(siblings[i]) || normalizeText(siblings[i].textContent);
                if (isLikelyUsername(text)) return text;
            }
        }

        for (i = 0; i < nodes.length; i += 1) {
            var rect = nodes[i].getBoundingClientRect();
            var value = getDirectText(nodes[i]) || normalizeText(nodes[i].textContent);
            if (rect.top >= 0 && rect.top < 80 && rect.left > window.innerWidth * 0.45 && isLikelyUsername(value)) {
                return value;
            }
        }

        return '';
    }

    function findColumnIndex(headers, aliases) {
        var i;
        var j;
        for (i = 0; i < headers.length; i += 1) {
            for (j = 0; j < aliases.length; j += 1) {
                if (normalizeText(headers[i]) === aliases[j]) return i;
            }
        }
        for (i = 0; i < headers.length; i += 1) {
            if (containsAny(headers[i], aliases)) return i;
        }
        return -1;
    }

    function getHeadersFromCells(cells) {
        var headers = [];
        for (var i = 0; i < cells.length; i += 1) {
            var cell = cells[i].querySelector('.cell');
            headers.push(normalizeText(cell ? cell.textContent : cells[i].textContent));
        }
        return headers;
    }

    function getCellText(row, index) {
        return normalizeText(row.children[index] ? row.children[index].textContent : '');
    }

    function getTaskRows(username) {
        var result = [];
        var roots = document.querySelectorAll('.el-table');

        for (var i = 0; i < roots.length; i += 1) {
            var headerCells = roots[i].querySelectorAll('.el-table__header-wrapper thead tr:last-child th');
            var rows = roots[i].querySelectorAll('.el-table__body-wrapper tbody tr');
            if (!headerCells.length || !rows.length) continue;

            var headers = getHeadersFromCells(headerCells);
            var assigneeIndex = findColumnIndex(headers, assigneeHeaders);
            if (assigneeIndex === -1) continue;

            for (var r = 0; r < rows.length; r += 1) {
                if (getCellText(rows[r], assigneeIndex) === username) {
                    result.push(rows[r]);
                }
            }
        }

        return result;
    }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent =
            '#' + CONTROL_ID + '{display:inline-flex;align-items:center;gap:8px;margin-left:10px;vertical-align:middle;}' +
            '#' + CONTROL_ID + ' button{height:32px;padding:0 14px;color:#fff;background:#409eff;border:0;border-radius:4px;cursor:pointer;font-size:14px;font-weight:600;}' +
            '#' + CONTROL_ID + ' button:disabled{cursor:not-allowed;background:#a0cfff;}' +
            '#' + CONTROL_ID + ' span{max-width:420px;color:#606266;font-size:12px;white-space:nowrap;}';
        document.head.appendChild(style);
    }

    function getSearchButton() {
        var nodes = document.querySelectorAll('button, a, [role="button"], .el-button');
        for (var i = 0; i < nodes.length; i += 1) {
            if (isVisible(nodes[i]) && !closest(nodes[i], '#' + CONTROL_ID) && normalizeText(nodes[i].textContent) === '搜索') {
                return nodes[i];
            }
        }
        return null;
    }

    function injectControlButton() {
        if (!document.body) return null;
        injectStyle();

        var control = document.getElementById(CONTROL_ID);
        var searchButton = getSearchButton();
        if (control) {
            if (searchButton && control.parentNode !== searchButton.parentNode) {
                searchButton.parentNode.insertBefore(control, searchButton.nextSibling);
            }
            return control;
        }

        if (!searchButton) return null;

        control = document.createElement('span');
        control.id = CONTROL_ID;
        control.innerHTML = '<button type="button" data-role="add">添加优先级</button><span data-role="status"></span>';
        searchButton.parentNode.insertBefore(control, searchButton.nextSibling);

        control.querySelector('[data-role="add"]').onclick = addPriorityToEditRemarks;
        return control;
    }

    function setStatus(text) {
        injectControlButton();
        var status = document.querySelector('#' + CONTROL_ID + ' [data-role="status"]');
        if (status) status.textContent = text;
    }

    function setButtonDisabled(disabled) {
        var button = document.querySelector('#' + CONTROL_ID + ' [data-role="add"]');
        if (button) button.disabled = disabled;
    }

    function waitFor(checker, timeout, callback) {
        var startedAt = Date.now();
        var timer = setInterval(function() {
            var result = checker();
            if (result || Date.now() - startedAt > timeout) {
                clearInterval(timer);
                callback(result || null);
            }
        }, 120);
    }

    function findButtonByText(root, text) {
        var nodes = root.querySelectorAll('button, a, [role="button"], span');
        for (var i = 0; i < nodes.length; i += 1) {
            if (!isVisible(nodes[i])) continue;
            if (normalizeText(nodes[i].textContent) !== text) continue;
            if (nodes[i].disabled || nodes[i].getAttribute('aria-disabled') === 'true') continue;
            if (String(nodes[i].className || '').indexOf('is-disabled') !== -1) continue;
            return nodes[i];
        }
        return null;
    }

    function findEditButton(row) {
        return findButtonByText(row, '编辑');
    }

    function getEditDialog() {
        var dialogs = document.querySelectorAll('.el-dialog, .el-overlay-dialog, [role="dialog"], .modal');
        for (var i = 0; i < dialogs.length; i += 1) {
            if (isVisible(dialogs[i]) && normalizeText(dialogs[i].textContent).indexOf('优先级') !== -1 && normalizeText(dialogs[i].textContent).indexOf('备注') !== -1) {
                return dialogs[i];
            }
        }
        return null;
    }

    function findFormItem(dialog, labelText) {
        var labels = dialog.querySelectorAll('.el-form-item__label, label');
        for (var i = 0; i < labels.length; i += 1) {
            if (normalizeText(labels[i].textContent).indexOf(labelText) !== -1) {
                return closest(labels[i], '.el-form-item') || labels[i].parentElement;
            }
        }
        return null;
    }

    function cleanPriority(text) {
        var match = normalizeText(text).match(/[1-6]/);
        return match ? match[0] : '';
    }

    function readPriority(dialog) {
        var item = findFormItem(dialog, '优先级');
        if (!item) return '';

        var selected = item.querySelector('.el-select__selected-item, .el-select__tags-text, .el-radio.is-checked, .el-radio-button.is-active, [aria-checked="true"]');
        if (selected) {
            var selectedPriority = cleanPriority(selected.textContent);
            if (selectedPriority) return selectedPriority;
        }

        var inputs = item.querySelectorAll('input, textarea');
        for (var i = 0; i < inputs.length; i += 1) {
            var inputPriority = cleanPriority(inputs[i].value || inputs[i].placeholder || inputs[i].textContent);
            if (inputPriority) return inputPriority;
        }

        return cleanPriority(item.textContent);
    }

    function getPriorityPrefix(text) {
        var match = String(text || '').match(/^(\s*)【优先级：([1-6])】/);
        return match ? { leading: match[1], priority: match[2], text: match[0] } : null;
    }

    function getRemarkInput(dialog) {
        var item = findFormItem(dialog, '备注');
        if (!item) return null;

        return item.querySelector('textarea') || item.querySelector('input');
    }

    function syncRemarkPriority(dialog, priority) {
        var input = getRemarkInput(dialog);
        var existing;

        if (!input) return 'failed';

        existing = getPriorityPrefix(input.value);
        if (existing && existing.priority === priority) return 'skipped';

        if (existing) {
            input.value = input.value.replace(/^(\s*)【优先级：[1-6]】/, '$1【优先级：' + priority + '】');
        } else {
            input.value = '【优先级：' + priority + '】' + input.value;
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return 'updated';
    }

    function clickConfirm(dialog) {
        var button = findButtonByText(dialog, '确定') || findButtonByText(document, '确定');
        if (!button) return false;
        button.click();
        return true;
    }

    function processRow(row, index, total, counters, callback) {
        var editButton = findEditButton(row);
        if (!editButton) {
            counters.failed += 1;
            callback();
            return;
        }

        setStatus('处理中 ' + (index + 1) + '/' + total + '：打开编辑');
        editButton.click();

        waitFor(getEditDialog, 7000, function(dialog) {
            if (!dialog) {
                counters.failed += 1;
                callback();
                return;
            }

            var priority = readPriority(dialog);
            var syncResult;

            if (!priority) {
                counters.failed += 1;
                var cancel = findButtonByText(dialog, '取消') || dialog.querySelector('.el-dialog__headerbtn');
                if (cancel) cancel.click();
                setTimeout(callback, 500);
                return;
            }

            syncResult = syncRemarkPriority(dialog, priority);
            if (syncResult === 'skipped') {
                counters.skipped += 1;
                var alreadyCancel = findButtonByText(dialog, '取消') || dialog.querySelector('.el-dialog__headerbtn');
                if (alreadyCancel) alreadyCancel.click();
                setTimeout(callback, 500);
                return;
            }

            if (syncResult !== 'updated') {
                counters.failed += 1;
                var failedCancel = findButtonByText(dialog, '取消') || dialog.querySelector('.el-dialog__headerbtn');
                if (failedCancel) failedCancel.click();
                setTimeout(callback, 500);
                return;
            }

            setStatus('处理中 ' + (index + 1) + '/' + total + '：校正优先级 ' + priority);
            if (!clickConfirm(dialog)) {
                counters.failed += 1;
                callback();
                return;
            }

            counters.updated += 1;
            waitFor(function() {
                return !document.body.contains(dialog) || !isVisible(dialog);
            }, 5000, function() {
                setTimeout(callback, 500);
            });
        });
    }

    function processRows(rows, index, counters, callback) {
        if (index >= rows.length) {
            callback();
            return;
        }

        processRow(rows[index], index, rows.length, counters, function() {
            processRows(rows, index + 1, counters, callback);
        });
    }

    function addPriorityToEditRemarks() {
        if (running) return;

        var username = detectCurrentUsername();
        if (!username) {
            setStatus('未识别到当前登录用户。');
            return;
        }

        var rows = getTaskRows(username);
        if (!rows.length) {
            setStatus('未找到认领人为 ' + username + ' 的任务。请先手动选择用户并搜索。');
            return;
        }

        if (!window.confirm('仅读取“优先级”并校正“备注”开头；已存在且正确的【优先级：X】会跳过，不正确会修正。需要点击“确定”保存备注。共 ' + rows.length + ' 条，继续？')) {
            return;
        }

        running = true;
        setButtonDisabled(true);
        var counters = { updated: 0, skipped: 0, failed: 0 };

        processRows(rows, 0, counters, function() {
            running = false;
            setButtonDisabled(false);
            setStatus('完成：保存 ' + counters.updated + ' 条，跳过 ' + counters.skipped + ' 条，失败 ' + counters.failed + ' 条。');
        });
    }

    function boot() {
        injectControlButton();
        var count = 0;
        var timer = setInterval(function() {
            count += 1;
            injectControlButton();
            if (document.getElementById(CONTROL_ID) || count > 40) clearInterval(timer);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
