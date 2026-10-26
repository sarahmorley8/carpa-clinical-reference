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

## Phase 3 (built release on https hosting)

12. **Install** (see `docs/deployment/install-on-phone.md`); Home shows **✓ Offline ready**.
13. **Airplane mode:** close the app fully, reopen from the icon; open Chest pain and the demo pathway.
14. **Step-through:** demo pathway → Child → No → 3 → Start timer → Yes. Change the first answer to Yes; confirm the
    "later answers were cleared" notice.
15. **Timer, screen on:** start a 1-minute timer; leave the app open; confirm alert dialog, sound (and vibration on
    Android).
16. **Timer, backgrounded:** start a 2-minute timer, switch to another app for 3 minutes, return: timer shows FINISHED
    and the alert appears. Record whether any sound/notification happened while away (expected: none on iPhone).
17. **Screen lock:** start a timer and check whether the screen stays on.
18. **Inactivity:** tick an item, leave the phone untouched (screen kept on by a timer, or awake) — confirm the warning
    at 59 minutes and the clear at 60 (or test on a build with a shortened limit).
19. **ISBAR:** tick items, Fill, Copy → confirm warning → paste into Notes; delete the note afterwards.
20. **Update:** publish a new build; reopen the app with a ticked item; confirm the update is held until End session.
21. **tel: links:** once real numbers are entered, confirm tapping opens the dialler with the right number and does not
    call automatically.
