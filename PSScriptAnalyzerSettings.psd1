@{
    # 安装/更新脚本：彩色终端、git 位置参数、无 ShouldProcess 的 Remove-Item 等，与可发布模块规范不同。
    Severity     = @('Error', 'Warning')
    ExcludeRules = @(
        'PSAvoidUsingWriteHost',
        'PSUseApprovedVerbs',
        'PSUseSingularNouns',
        'PSUseShouldProcessForStateChangingFunctions',
        'PSAvoidUsingPositionalParameters'
    )
}
