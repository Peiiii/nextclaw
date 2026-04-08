#!/bin/bash

set -u

INSTALL_URL="https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/install.sh"

echo "检查 Skillhub 安装状态..."
echo "=========================="

if command -v skillhub >/dev/null 2>&1; then
    echo "已检测到 Skillhub CLI"
    echo "路径: $(command -v skillhub)"

    if skillhub --version >/dev/null 2>&1; then
        echo "版本: $(skillhub --version 2>/dev/null)"
    else
        echo "版本: 无法获取"
    fi

    if skillhub --help >/dev/null 2>&1; then
        echo "就绪检查: skillhub --help 可执行"
    else
        echo "就绪检查: skillhub --help 执行失败"
    fi
else
    echo "未检测到 Skillhub CLI"
    echo
    echo "默认推荐: 仅安装 CLI"
    echo "curl -fsSL ${INSTALL_URL} | bash -s -- --cli-only"
    echo
    echo "如需上游默认完整安装:"
    echo "curl -fsSL ${INSTALL_URL} | bash"
fi

echo
echo "使用提示:"
echo "- 以 'skillhub --help' 与实际 search/install 命令作为可用性的真相源"
echo "- 使用 'skillhub search <关键词>' 搜索技能"
echo "- 使用 'skillhub install <技能名>' 安装到当前 workspace"
