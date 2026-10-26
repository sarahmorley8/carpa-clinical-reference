# Manual device test scripts

Record: device, OS version, browser, date, tester, result (pass/fail + notes).

## Phase 2 (preview, online)

1. **Open on iPhone Safari** at the preview URL. Disclaimer appears; tap "I understand". Home shows CRITICAL tiles.
2. **Two taps:** Home → "Chest pain" → "Call for help / evacuation criteria". Confirm both screens are readable.
3. **Sunlight:** outdoors at full brightness, read the red flags and a NOT ENTERED label on the asthma template.
4. **Low light:** Settings → Dark. Repeat step 3 indoors at low brightness.
5. **Text size:** Settings → 150%. Check that nothing is cut off on the pathway screen.
6. **One-handed:** reach the bottom navigation and the red escalation bar with one thumb.
7. **VoiceOver:** navigate Home → demo pathway; confirm headings, checkboxes and status labels are announced.
8. **Patient group:** tick an item, switch to Child; confirm the warning; confirm ticks clear.
9. **End session:** tick items, End session → Clear everything; confirm all cleared.
10. **Reload / close app:** tick items, close the tab or app, reopen; confirm nothing is ticked.
11. Repeat 1–10 on **Android Chrome** (TalkBack instead of VoiceOver).

Phase 3 will add: Add to Home Screen, airplane-mode launch, offline readiness indicator, timers with screen locked,
backgrounding, update while a session is active.
