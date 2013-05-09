// State variables
var gReviewBanner = $("#review-banner");
var issueSummaryTableManager;


/* Handles a comment issue in either the review details page, or the
 * inline comment viewer.
 * @param review_id the id of the review that the comment belongs to
 * @param comment_id the id of the comment with the issue
 * @param comment_type dictates the type of comment - either
 *                     "diff_comments", "screenshot_comments" or
 *                     "file_attachment_comments".
 * @param issue_status the initial status of the comment - either
 *                     "open", "resolved" or "dropped"
 * @param interactive true if the user should be shown buttons to
 *                    manipulate the comment issue - otherwise false.
 */
$.fn.commentIssue = function(review_id, comment_id, comment_type,
                             issue_status, interactive) {
    var self = this;
    var OPEN = 'open';
    var RESOLVED = 'resolved';
    var DROPPED = 'dropped';

    var issue_reopen_button = $(".issue-button.reopen", this);
    var issue_resolve_button = $(".issue-button.resolve", this);
    var issue_drop_button = $(".issue-button.drop", this);
    self.review_id = review_id;
    self.comment_id = comment_id;
    self.comment_type = comment_type;
    self.issue_status = issue_status;
    self.interactive = interactive;

    function disableButtons() {
        issue_reopen_button.attr("disabled", true);
        issue_resolve_button.attr("disabled", true);
        issue_drop_button.attr("disabled", true);
    }

    function enableButtons() {
        issue_reopen_button.attr("disabled", false);
        issue_resolve_button.attr("disabled", false);
        issue_drop_button.attr("disabled", false);
    }

    function enterState(state) {
        disableButtons();
        gCommentIssueManager.setCommentState(self.review_id, self.comment_id,
                                             self.comment_type, state);
    }

    issue_reopen_button.click(function() {
        enterState(OPEN);
    });

    issue_resolve_button.click(function() {
        enterState(RESOLVED);
    });

    issue_drop_button.click(function() {
        enterState(DROPPED);
    });

    self.enter_state = function(state) {
        self.state = self.STATES[state];
        self.state.enter();
        if (self.interactive) {
            self.state.showButtons();
            enableButtons();
        }
    }

    self.update_issue_summary_table = function(new_status, old_status, timestamp) {
        var comment_id = self.comment_id,
            entry = $('#summary-table-entry-' + comment_id),
            buttonTop = self.offset().top;

        issueSummaryTableManager.updateStatus(entry, old_status, new_status);
        issueSummaryTableManager.updateCounters(old_status, new_status);
        issueSummaryTableManager.updateTimeStamp(entry, timestamp);

        /*
         * Update the scroll position to counteract the addition/deletion
         * of the entry in the issue summary table, so the page doesn't
         * appear to jump.
         */
        $(window).scrollTop($(window).scrollTop() + self.offset().top -
                            buttonTop);
    }

    var open_state = {
        enter: function() {
            $(".issue-button.reopen", self).hide();
            $(".issue-state", self)
                .removeClass("dropped")
                .removeClass("resolved")
                .addClass("open");
            $(".issue-message", self)
                .text("An issue was opened.");
        },
        showButtons: function() {
            $(".issue-button.drop", self).show();
            $(".issue-button.resolve", self).show();
        }
    }

    var resolved_state = {
        enter: function() {
            $(".issue-button.resolve", self).hide();
            $(".issue-button.drop", self).hide();
            $(".issue-state", self)
                .removeClass("dropped")
                .removeClass("open")
                .addClass("resolved");
            $(".issue-message", self)
                .text("The issue has been resolved.");
        },
        showButtons: function() {
            $(".issue-button.reopen", self).show();
        }
    }

    var dropped_state = {
        enter: function() {
            $(".issue-button.resolve", self).hide();
            $(".issue-button.drop", self).hide();
            $(".issue-state", self)
                .removeClass("open")
                .removeClass("resolved")
                .addClass("dropped");
            $(".issue-message", self)
                .text("The issue has been dropped.");
        },
        showButtons: function() {
            $(".issue-button.reopen", self).show();
        }
    }

    self.STATES = {};
    self.STATES[OPEN] = open_state;
    self.STATES[RESOLVED] = resolved_state;
    self.STATES[DROPPED] = dropped_state;

    // Set the comment to the initial state
    self.enter_state(self.issue_status);

    // Register to watch updates on the comment issue state
    gCommentIssueManager
        .registerCallback(self.comment_id, self.enter_state);

    // Register to update issue summary table
    gCommentIssueManager
        .registerCallback(self.comment_id, self.update_issue_summary_table);

    return self;
}



/*
 * Wraps an inline comment so that they can display issue
 * information.
 */
$.fn.issueIndicator = function() {
    var issue_indicator = $('<div/>')
        .addClass('issue-state')
        .appendTo(this);

    var message = $('<span/>')
        .addClass('issue-message')
        .appendTo(issue_indicator);

    return this;
}


/*
 * Wraps an inline comment so that it displays buttons
 * for setting the state of a comment issue.
 */
$.fn.issueButtons = function() {
    var issue_indicator = $(".issue-state", this);

    var buttons = $('<div class="buttons"/>')
        .addClass('buttons')
        .appendTo(issue_indicator);

    var resolve_string = "Fixed";
    var drop_string = "Drop";
    var reopen_string = "Re-open";

    var button_string = '<input type="button" class="issue-button resolve"'
                      + 'value="' + resolve_string + '"/>'
                      + '<input type="button" class="issue-button drop"'
                      + 'value="' + drop_string + '"/>'
                      + '<input type="button" class="issue-button reopen"'
                      + 'value="' + reopen_string + '"/>';

    buttons.append(button_string);

    return this;
}


/*
 * Creates a floating reply banner. The banner will stay in view while the
 * parent review is visible on screen.
 */
$.replyDraftBanner = function(review_reply, bannerButtonsEl) {
    var banner = $("<div/>")
        .addClass("banner")
        .append("<h1>This reply is a draft</h1>")
        .append(" Be sure to publish when finished.")
        .append($('<input type="button"/>')
            .val("Publish")
            .click(function() {
                review_reply.ready({
                    ready: function() {
                        review_reply.set('public', true);
                        review_reply.save({
                            buttons: bannerButtonsEl,
                            success: function() {
                                window.location = gReviewRequestPath;
                            }
                        });
                    }
                });
            })
        )
        .append($('<input type="button"/>')
            .val("Discard")
            .click(function() {
                review_reply.destroy({
                    buttons: bannerButtonsEl,
                    success: function() {
                        window.location = gReviewRequestPath;
                    }
                });
            })
        )
        .floatReplyDraftBanner();

    return banner;
}

/*
 * Floats a reply draft banner. This ensures it's always visible on screen
 * when the review is visible.
 */
$.fn.floatReplyDraftBanner = function() {
    return $(this).each(function() {
        var self = $(this);
        var floatSpacer = null;
        var container = null;

        $(window)
            .scroll(updateFloatPosition)
            .resize(updateSize);
        _.defer(updateFloatPosition);

        function updateSize() {
            if (floatSpacer != null) {
                self.width(floatSpacer.parent().width() -
                           self.getExtents("bpm", "lr"));
            }
        }

        function updateFloatPosition() {
            if (self.parent().length == 0) {
                return;
            }

            /*
             * Something about the below causes the "Publish" button to never
             * show up on IE8. Turn it into a fixed box on IE.
             */
            if ($.browser.msie) {
                return;
            }

            if (floatSpacer == null) {
                floatSpacer = self.wrap($("<div/>")).parent();
                updateSize();
            }

            if (container == null) {
                container = self.closest('.review');
            }

            var containerTop = container.offset().top;
            var windowTop = $(window).scrollTop();
            var topOffset = floatSpacer.offset().top - windowTop;
            var outerHeight = self.outerHeight();

            if (!container.hasClass("collapsed") &&
                topOffset < 0 &&
                containerTop < windowTop &&
                windowTop < (containerTop + container.outerHeight() -
                             outerHeight)) {
                self
                    .addClass('floating')
                    .css({
                        top: 0,
                        position: "fixed"
                    });

                updateSize();
            } else {
                self
                    .removeClass('floating')
                    .css({
                        top: '',
                        position: ''
                    });
            }
        }
    });
}


/*
 * Creates a review form for modifying a new review.
 *
 * This provides editing capabilities for creating or modifying a new
 * review. The list of comments are retrieved from the server, providing
 * context for the comments.
 *
 * @param {RB.Review} review  The review to create or modify.
 *
 * @return {jQuery} The new review form element.
 */
$.reviewForm = function(review) {
    RB.apiCall({
        type: "GET",
        dataType: "html",
        data: {},
        url: gReviewRequestPath + "reviews/draft/inline-form/",
        success: function(html) {
            createForm(html);
        }
    });

    var dlg;
    var buttons;

    /*
     * Creates the actual review form. This is called once we have
     * the HTML for the form from the server.
     *
     * @param {string} formHTML  The HTML content for the form.
     */
    function createForm(formHTML) {
        reviewRequestEditor.incr('editCount');

        /* XXX Remove this global when we can. */
        window.gReviewFormDiffQueue = new RB.DiffFragmentQueueView({
            containerPrefix: 'review_draft_comment_container',
            reviewRequestPath: gReviewRequestPath,
            queueName: 'review_draft_diff_comments'
        });

        dlg = $("<div/>")
            .attr("id", "review-form")
            .appendTo("body") // Needed for scripts embedded in the HTML
            .html(formHTML)
            .modalBox({
                title: "Review for: " + gReviewRequestSummary,
                stretchX: true,
                stretchY: true,
                buttons: [
                    $('<input type="button"/>')
                        .val("Publish Review")
                        .click(function(e) {
                            saveReview(true);
                            return false;
                        }),
                    $('<input type="button"/>')
                        .val("Discard Review")
                        .click(function(e) {
                            reviewRequestEditor.decr('editCount');
                            review.destroy({
                                buttons: buttons,
                                success: function() {
                                    RB.DraftReviewBannerView.instance.hideAndReload();
                                }
                            });
                        }),
                    $('<input type="button"/>')
                        .val("Cancel")
                        .click(function() {
                            reviewRequestEditor.decr('editCount');
                        }),
                    $('<input type="button"/>')
                        .val("Save")
                        .click(function() {
                            saveReview();
                            return false;
                        })
                ]
            })
            .keypress(function(e) { e.stopPropagation(); })
            .trigger("ready");

        buttons = $("input", dlg);

        var body_classes = ["body-top", "body-bottom"];

        for (var i in body_classes) {
            var cls = body_classes[i];
            $("." + cls, dlg)
                .inlineEditor({
                    cls: cls + "-editor",
                    extraHeight: 50,
                    forceOpen: true,
                    multiline: true,
                    notifyUnchangedCompletion: true,
                    showButtons: false,
                    showEditIcon: false
                })
                .on({
                    "beginEdit": function() {
                        reviewRequestEditor.incr('editCount');
                    },
                    "cancel complete": function() {
                        reviewRequestEditor.decr('editCount');
                    }
                });
        }

        $("textarea:first", dlg).focus();
        dlg.attr("scrollTop", 0);

        gReviewFormDiffQueue.loadFragments();
    }

    /*
     * Saves the review.
     *
     * This sets the ship_it and body values, and saves all comments.
     */
    function saveReview(publish) {
        $.funcQueue("reviewForm").clear();

        $(".body-top, .body-bottom").inlineEditor("save");

        $(".comment-editable", dlg).each(function() {
            var editable = $(this);
            var comment = editable.data('comment');
            var issue = editable.next()[0];
            var issueOpened = issue ? issue.checked : false;

            if (editable.inlineEditor("dirty") ||
                issueOpened != comment.issue_opened) {
                comment.issue_opened = issueOpened;
                $.funcQueue("reviewForm").add(function() {
                    editable
                        .one("saved", $.funcQueue("reviewForm").next)
                        .inlineEditor("save");
              });
            }
        });

        $.funcQueue("reviewForm").add(function() {
            review.set({
                shipIt: $("#id_shipit", dlg)[0].checked,
                bodyTop: $(".body-top", dlg).text(),
                bodyBottom: $(".body-bottom", dlg).text(),
                public: publish
            });

            reviewRequestEditor.decr('editCount');

            review.save({
                buttons: buttons,
                success: $.funcQueue("reviewForm").next,
                error: function() {
                    console.log(arguments);
                }
            });
        });

        $.funcQueue("reviewForm").add(function() {
            var reviewBanner = RB.DraftReviewBannerView.instance;

            dlg.modalBox("destroy");

            if (publish) {
                reviewBanner.hideAndReload();
            } else {
                reviewBanner.show();
            }
        });

        $.funcQueue("reviewForm").start();
    }
};


/*
 * Adds inline editing capabilities to a comment in the review form.
 *
 * @param {object} comment  A RB.DiffComment, RB.FileAttachmentComment
 *                          or RB.ScreenshotComment instance
 *                          to store the text on and save.
 */
$.fn.reviewFormCommentEditor = function(comment) {
    var self = this;

    return this
        .inlineEditor({
            extraHeight: 50,
            forceOpen: true,
            multiline: true,
            notifyUnchangedCompletion: true,
            showButtons: false,
            showEditIcon: false,
            useEditIconOnly: false
        })
        .on({
            "beginEdit": function() {
                reviewRequestEditor.incr('editCount');
            },
            "cancel": function() {
                reviewRequestEditor.decr('editCount');
            },
            "complete": function(e, value) {
                reviewRequestEditor.decr('editCount');
                comment.set('text', value);
                comment.save({
                    success: function() {
                        self.trigger("saved");
                    }
                });
            }
        })
        .data('comment', comment);
};


/*
 * Registers for updates to the review request. This will cause a pop-up
 * bubble to be displayed when updates of the specified type are displayed.
 *
 * @param {string} lastTimestamp  The last known update timestamp for
 *                                comparison purposes.
 * @param {string} type           The type of update to watch for, or
 *                                undefined for all types.
 */
RB.registerForUpdates = function(lastTimestamp, type) {
    function updateFavIcon(url) {
        var head = $("head");
        head.find("link[rel=icon]").remove();
        head.append($("<link/>")
            .attr({
                href: url,
                rel: "icon",
                type: "image/x-icon"
            }));
    }

    var bubble = $("#updates-bubble");
    var summaryEl;
    var userEl;

    var faviconEl = $("head").find("link[rel=icon]");
    var faviconURL = faviconEl.attr("href");
    var faviconNotifyURL = STATIC_URLS["rb/images/favicon_notify.ico"];

    gReviewRequest.on('updated', function(info) {
        if (bubble.length == 0) {
            updateFavIcon(faviconNotifyURL);

            bubble = $('<div id="updates-bubble"/>');
            summaryEl = $('<span/>')
                .appendTo(bubble);
            bubble.append(" by ");
            userEl = $('<a href="" id="updates-bubble-user"/>')
                .appendTo(bubble);

            bubble
                .append(
                    $('<span id="updates-bubble-buttons"/>')
                        .append($('<a href="#">Update Page</a>')
                            .click(function() {
                                window.location = gReviewRequestPath;
                                return false;
                            }))
                        .append(" | ")
                        .append($('<a href="#">Ignore</a>')
                            .click(function() {
                                bubble.fadeOut();
                                updateFavIcon(faviconURL);
                                return false;
                            }))
                )
                .appendTo(document.body);
        }

        summaryEl.text(info.summary);
        userEl
            .attr('href', info.user.url)
            .text(info.user.fullname || info.user.username);

        bubble
            .hide()
            .css("position", $.browser.msie && $.browser.version == 6
                             ? "absolute" : "fixed")
            .fadeIn();
    });

    gReviewRequest.beginCheckForUpdates(type, lastTimestamp);
}


/*
 * Initializes review request pages.
 *
 * XXX This is a temporary function that exists while we're transitioning
 *     to Backbone.js.
 */
RB.initReviewRequestPage = function() {
    var pendingReview = gReviewRequest.createReview(),
        reviewBanner;

    reviewBanner = RB.DraftReviewBannerView.create({
        el: $('#review-banner'),
        model: pendingReview
    });

    pendingReview.on('destroyed published', function() {
        reviewBanner.hideAndReload();
    });

    /* Edit Review buttons. */
    $("#review-link").click(function() {
        $.reviewForm(pendingReview);
    });

    $("#shipit-link").click(function() {
        if (confirm("Are you sure you want to post this review?")) {
            pendingReview.set({
                shipIt: true,
                bodyTop: 'Ship It!',
                public: true
            });
            pendingReview.save({
                buttons: null,
                success: function() {
                    RB.DraftReviewBannerView.instance.hideAndReload();
                }
            });
        }
    });

    issueSummaryTableManager = new RB.IssueSummaryTableView({
        el: $('#issue-summary'),
        model: gCommentIssueManager
    });
    issueSummaryTableManager.render();
}

// vim: set et:sw=4:
