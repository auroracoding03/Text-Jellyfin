!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!macro customHeader
  !ifndef BUILD_UNINSTALLER
  Var TextJellyfinLibraryPath
  Var TextJellyfinLibraryInput
  Var TextJellyfinExistingService

  Function TextJellyfinBrowseLibrary
    nsDialogs::SelectFolderDialog "Select the authoritative Text Jellyfin library" "$TextJellyfinLibraryPath"
    Pop $0
    ${If} $0 != error
      StrCpy $TextJellyfinLibraryPath $0
      ${NSD_SetText} $TextJellyfinLibraryInput $TextJellyfinLibraryPath
    ${EndIf}
  FunctionEnd

  Function TextJellyfinConfigPage
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 28u "Choose the existing library folder. Source articles, uploads, pasted notes, and *.meta.yaml sidecars remain in this folder and are never copied or removed."
    Pop $0
    ${NSD_CreateDirRequest} 0 38u 82% 13u "$TextJellyfinLibraryPath"
    Pop $TextJellyfinLibraryInput
    ${NSD_CreateBrowseButton} 84% 38u 16% 13u "Browse…"
    Pop $0
    ${NSD_OnClick} $0 TextJellyfinBrowseLibrary
    ${NSD_CreateLabel} 0 62u 100% 40u "The installer creates a fresh disposable index under %ProgramData%\TextJellyfin\data, generates non-default Basic Auth credentials, and runs an initial rescan. The v0.9 per-user installation is left intact for rollback."
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function TextJellyfinConfigPageLeave
    ${NSD_GetText} $TextJellyfinLibraryInput $TextJellyfinLibraryPath
    ${If} $TextJellyfinLibraryPath == ""
      MessageBox MB_ICONSTOP "Choose a library folder."
      Abort
    ${EndIf}
  FunctionEnd
  !endif
!macroend

!macro customWelcomePage
  !ifndef BUILD_UNINSTALLER
  !insertmacro MUI_PAGE_WELCOME
  Page custom TextJellyfinConfigPage TextJellyfinConfigPageLeave
  !endif
!macroend

!macro customInit
  StrCpy $TextJellyfinLibraryPath "$DOCUMENTS\Text Jellyfin Library"
  StrCpy $TextJellyfinExistingService "0"

  nsExec::ExecToStack 'sc.exe query "TextJellyfin"'
  Pop $0
  Pop $1
  ${If} $0 == 0
    StrCpy $TextJellyfinExistingService "1"
  ${EndIf}

  File /oname=$PLUGINSDIR\preinstall-service.ps1 "${BUILD_RESOURCES_DIR}\preinstall-service.ps1"
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\preinstall-service.ps1"' $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "Migration preflight failed. Quit Text Jellyfin v0.9, free port 3000, and retry. No library files were changed."
    Abort
  ${EndIf}

  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Text Jellyfin"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.textjellyfin.app"
!macroend

!macro customInstall
  File /oname=$PLUGINSDIR\configure-service.ps1 "${BUILD_RESOURCES_DIR}\configure-service.ps1"
  File /oname=$PLUGINSDIR\verify-service-health.ps1 "${BUILD_RESOURCES_DIR}\verify-service-health.ps1"

  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\configure-service.ps1" -LibraryPath "$TextJellyfinLibraryPath"' $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "Unable to create the machine service configuration or required ACL/firewall rules."
    Abort
  ${EndIf}

  ${If} $TextJellyfinExistingService == "0"
    ExecWait '"$INSTDIR\resources\service\TextJellyfin.Service.exe" install' $0
    ${If} $0 != 0
      MessageBox MB_ICONSTOP "WinSW could not install the Text Jellyfin service."
      Abort
    ${EndIf}
  ${EndIf}

  ExecWait '"$INSTDIR\resources\service\TextJellyfin.Service.exe" start' $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "The Text Jellyfin service could not start. Check %ProgramData%\TextJellyfin\logs."
    Abort
  ${EndIf}

  ${If} $TextJellyfinExistingService == "0"
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\verify-service-health.ps1" -Rescan' $0
  ${Else}
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\verify-service-health.ps1"' $0
  ${EndIf}
  ${If} $0 != 0
    ExecWait '"$INSTDIR\resources\service\TextJellyfin.Service.exe" stop'
    MessageBox MB_ICONSTOP "The installed service failed its authenticated health check. It has been stopped; library files were not changed."
    Abort
  ${EndIf}
!macroend

!macro customUnInstall
  IfFileExists "$INSTDIR\resources\service\TextJellyfin.Service.exe" 0 +3
    ExecWait '"$INSTDIR\resources\service\TextJellyfin.Service.exe" stop'
    ExecWait '"$INSTDIR\resources\service\TextJellyfin.Service.exe" uninstall'
  nsExec::ExecToLog 'netsh.exe advfirewall firewall delete rule name="Text Jellyfin Library Server"'
  DetailPrint "Library and %ProgramData%\TextJellyfin configuration/data were retained for rollback."
!macroend
