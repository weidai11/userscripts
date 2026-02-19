**Source:** [LessWrong Power Reader (Greasemonkey script, updated) — LessWrong](https://www.lesswrong.com/posts/KFCHH2ZtuRvXo7EZZ/lesswrong-power-reader-greasemonkey-script-updated#:~:text=I%20posted%20this%20script%20previously,Firefox%2013.0.1%20and%20Chrome%2020.0)
**Captured:** 2/1/2026, 3:16:17 AM
**Web Clipper Max Version:** 1.0.362

---

I posted [this script](http://www.ibiblio.org/weidai/lesswrong_comments_reade.user.js) previously to Open Thread, but it got broken by the discussion/main split-up and also didn't work in Firefox 4. It's now updated and fixed for Firefox 4. The original description follows. See the [previous thread](https://www.lesswrong.com/lw/2nz/less_wrong_open_thread_september_2010/2l9m) for some additional questions and answers. (ETA: Firefox 4 seems to have made the script much faster, so try it again if you were previously put off by the slowness.)

For those who may be having trouble keeping up with "Recent Comments" or finding the interface a bit plain, I've written a [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) script to make it easier/prettier. Here is a [screenshot](http://www.ibiblio.org/weidai/lw_screenshot.png).

Explanation of features:

*   loads and threads up to 400 most recent comments on one screen
*   use \[↑\] and \[↓\] to mark favored/disfavored authors
*   comments are color coded based on author/points (pink) and recency (yellow)
*   replies to you are outlined in red
*   hover over \[+\] to view single collapsed comment
*   hover over/click \[^\] to highlight/scroll to parent comment
*   marks comments read (grey) based on scrolling
*   shows only new/unread comments upon refresh
*   date/time are converted to your local time zone
*   click comment date/time for permalink

To install, first get Greasemonkey, then click [here](http://www.ibiblio.org/weidai/lesswrong_comments_reade.user.js). Once that's done, use [this link](https://www.lesswrong.com/reader) to get to the reader interface.

I've placed the script is in the public domain. EDIT: Chrome is supported as of version 1.0.5 of the script.

On a related note, [here](http://www.ibiblio.org/weidai/lesswrong_user.php) is a way to view all posts and comments of a particular LW user as a single HTML page.

EDIT - Version History:

*   1.0.5
    *   loads comments directly from LW instead of through another server
    *   added Chrome support
    *   auto checking/notification of new versions
    *   can specify a starting point to load comments from (if you want, you can read all LW comments, 400 at a time, by starting at comment ID 1)
    *   can collapse all comments under a post
*   1.0.6 (10/4/2011)
    *   misc bug fixes
    *   number of comments loaded changed to 800
    *   tested on Firefox 7.0 and Chrome 14.0
*   1.0.7 (11/10/2011)
    *   bug fixes
    *   number of comments loaded changed to 800 on Chrome
*   1.0.8 (7/16/2012)
    *   fixed broken parsing (pengvado)
    *   tested on Firefox 13.0.1 and Chrome 20.0

---
**END OF SITE CONTENT**