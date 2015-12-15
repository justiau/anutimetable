var rawLessons      = [];
var timetableData   = {};
var hasLocalStorage = typeof(Storage) !== "undefined";
var recover         = false;

var Calendar = {
    initialize        : function () {
        this.tradingHours             = {
            start_hour       : 8,
            normal_start_hour: 9,
            normal_end_hour  : 18,
            end_hour         : 20
        };
        this.weekdays                 = ['mon', 'tue', 'wed', 'thu', 'fri'];
        this.template                 = _.template($("#calendar-template").text());
        this.compulsaryLessonTemplate = $("#compulsary-event-template").text();
        this.groupLessonTemplate      = $("#group-event-template").text();
        this.html                     = this.template(this.tradingHours);
        this.courseGrids              = []; // new Array(12 * 2).fill(new Array(5).fill([]));
        for (var i = 0; i < (this.tradingHours.end_hour - this.tradingHours.start_hour) * 2; i++) {
            var temp = [];
            for (var j = 0; j < this.weekdays.length; j++)
                temp.push([]);
            this.courseGrids.push(temp);
        }
    },
    putItem           : function (item, displayDiv) {

        // Determine the index for search in courseGrids
        var index    = (item.start - Calendar.tradingHours.start_hour) * 2;
        var dayIndex = Calendar.weekdays.indexOf(item.day);
        var rowspan  = item.dur * 2;
        var dayCell  = $('.table.table-striped th.col-sm-2:nth(' + dayIndex + ')');
        var colspan  = !dayCell.attr('colspan') ? 0 : parseInt(dayCell.attr('colspan'));

        // Separate empty cells
        if (!recover) Calendar.columnSeparate();

        Calendar.courseGrids = Calendar.fillArray(Calendar.courseGrids, item.name + ' ' + item.info, (item.start - Calendar.tradingHours.start_hour) * 2, dayIndex, rowspan, 0);
        var currentIndex     = Calendar.courseGrids[0];
        Calendar.courseGrids = Calendar.courseGrids[1];

        // Changing the colspan of the title (mon, tue, ...)
        dayCell.attr('colspan', Calendar.courseGrids[0][dayIndex].length + 1);

        // Creating empty cells if not exist, or separating the existing one
        if (!$('.timeslot[data-day="' + item.day + '"][data-index="' + currentIndex + '"]').length) {
            $('.timetable-row').each(function () {
                var beforeElement = $(this).find('[data-day="' + item.day + '"]:last');
                beforeElement.after(beforeElement.clone().show().removeAttr('rowspan').removeAttr('colspan').attr('data-index', currentIndex).empty());
            });
        }

        var targetElement = $('.timeslot[data-hour="' + item.start + '"][data-day="' + item.day + '"][data-index="' + currentIndex + '"]');

        // Fill with the content
        targetElement.attr('rowspan', rowspan).append(displayDiv.hide().fadeIn());

        // Remove cells for rowspan
        for (var i = 0.5; i < item.dur; i += 0.5)
            $('.timeslot[data-hour="' + (item.start + i) + '"][data-day="' + item.day + '"][data-index="' + currentIndex + '"]').remove();

        // If it's not recovering courses from storage, then merge horizontal cells
        if (!recover) Calendar.columnMerge().togglePlaceholders();

        if (item.start < 9 || item.start >= 18) {
            _($(".timetable-row")).each(function (row) {
                if ($(row).data('hour') < 9 || $(row).data('hour') >= 18) {
                    $(row).show('slide');
                }
            })
        }

    },
    putCompulsaryItem : function (item) {
        var displayDiv = $(_.template(Calendar.compulsaryLessonTemplate, {item: item}));
        Calendar.putItem(item, displayDiv);
    },
    putGroupItem      : function (item) {
        var displayDiv = $(_.template(Calendar.groupLessonTemplate, {item: item}));

        $(displayDiv.find("a.choose")[0]).on("click", function (event) {
            event.preventDefault();
            _($(".lesson")).each(function (item) {
                var $item = $(item);
                if ($item.data("group") == displayDiv.data("group")) {
                    if ($item.data("fgroup") != displayDiv.data("fgroup")) {
                        var index = $.inArray($item.data('fgroup'), Course.tutorials[$item.data('group')]);
                        if (index !== -1) Course.tutorials[$item.data('group')].splice(index, 1);
                        $item.hide('slide', $item.remove);
                    } else {
                        $("[data-fgroup='" + displayDiv.data("fgroup") + "'] a.choose").hide("scale");
                    }
                }
            });
            Course.save();
        });

        Calendar.putItem(item, displayDiv);

        // Hide all but one of the (choose) links
        $("[data-fgroup='" + displayDiv.data("fgroup") + "'] a.choose").slice(1).hide();
    },
    putLessonGroup    : function (group) {
        if (group[0] == "group") {
            for (var i = group[1].length - 1; i >= 0; i--) {
                var key      = group[1][i].name + filterNumbers(group[1][i].info),
                    tutFound = $.inArray(group[1][i].name + group[1][i].info, Course.tutorials[key]) !== -1;

                // Build tutorial object if is not in recovering mode
                if (!recover && !tutFound) {
                    if (!Course.tutorials[key]) Course.tutorials[key] = [];
                    Course.tutorials[key].push(group[1][i].name + group[1][i].info);
                }

                if (!recover || recover && tutFound) Calendar.putGroupItem(group[1][i]);
            }
        } else {
            Calendar.putCompulsaryItem(group[1]);
        }
    },
    columnMerge       : function () {

        $.each(Calendar.courseGrids, function (j, row) {
            $.each(row, function (k, arr) {
                var colspan     = 1;
                var removeLists = [];
                var elements    = $('.timeslot[data-hour="' + (0.5 * j + Calendar.tradingHours.start_hour) + '"][data-day="' + Calendar.weekdays[k] + '"]');
                for (var i = arr.length - 1; i >= 0; i--) {
                    var targetElement = elements.filter('[data-index="' + i + '"]:not([rowspan])');
                    if (!targetElement.length) {
                        if (removeLists.length > 1 && arr.length - 1 !== i) {
                            targetElement = elements.filter('[data-index="' + (i + 1) + '"]');
                            targetElement.attr('colspan', colspan - 1);
                            removeLists.pop();
                            $.each(removeLists, function (i, element) {
                                element.remove();
                            });
                        }
                        break;
                    } else if (arr[i] !== 0 || i === 0) {
                        var rowspan = targetElement.attr('rowspan');
                        if (colspan > 1)   targetElement.attr('colspan', colspan);
                        $.each(removeLists, function (i, element) {
                            element.remove();
                        });
                        break;
                    }
                    removeLists.push(targetElement);
                    colspan++;
                }
            });
        });

        /*
         $('.timeslot:not(:empty)').each(function () {
         var removeList = [];
         var hour       = parseInt($(this).data('hour'));
         var day        = $(this).data('day');
         var index      = parseInt($(this).data('index'));
         var siblings   = $(this).find('~[data-day="' + day + '"]');
         if (siblings.length === siblings.filter(':empty').length && siblings.filter(':last').data('index') == index + siblings.length) {
         $(this).attr('colspan', siblings.length + 1);
         removeList.push(siblings);
         if ($(this).attr('rowspan')) {
         for (var i = 0; i < $(this).attr('rowspan') / 2; i += 0.5) {
         var nextSiblings = $('.timeslot[data-hour="' + (hour + i) + '"][data-day="' + day + '"][data-index="' + (index + 1) + '"] ~');
         if (siblings.length !== nextSiblings.find('~[data-day="' + day + '"]').length + 1 || nextSiblings.filter(':last').data('index') != index + siblings.length) {
         return;
         }
         removeList.push(nextSiblings.find('~[data-day="' + day + '"]'));
         }
         }
         }
         $.each(removeList, function (i, v) {
         v.remove();
         });*/
        return Calendar;
    },
    columnSeparate    : function () {

        // Creating a pending list for correct order
        var pendingList = {}, sortKeyList = [];
        $('.timeslot[rowspan]:empty').each(function () {
            var index   = parseInt($(this).data('index'));
            var hour    = parseInt($(this).data('hour'));
            var day     = $(this).data('day');
            var colspan = $(this).attr('colspan');

            for (var i = 0.5; i < $(this).attr('rowspan') / 2; i += 0.5) {
                if (!pendingList[index]) {
                    pendingList[index] = [];
                    sortKeyList.push(index);
                }
                pendingList[index].push([
                    $('.timeslot[data-hour="' + (hour + i) + '"][data-day="' + day + '"]:last'),
                    $(this).clone().show().attr('data-hour', hour + i).removeAttr('rowspan').attr('data-index', index).empty()
                ]);
            }
            $(this).removeAttr('rowspan');

        });

        sortKeyList.sort();
        $.each(sortKeyList, function (i, key) {
            console.log(pendingList[key]);
            $.each(pendingList[key], function (j, v) {
                v[0].after(v[1]);
            });
        });

        $('.timeslot[colspan]').each(function () {
            var cloneNum = $(this).attr('colspan');
            var index    = parseInt($(this).data('index'));
            var hour     = parseInt($(this).data('hour'));
            var day      = $(this).data('day');

            $(this).removeAttr('colspan');
            if (cloneNum <= 1) return;

            var lastCell = $(this);
            for (var i = 1; i < cloneNum; i++) {
                lastCell.after(lastCell = lastCell.clone().show().removeAttr('rowspan').removeAttr('colspan').attr('data-index', index + i).empty());
                if ($(this).attr('rowspan') > 1) {
                    for (var j = 0.5; j < $(this).attr('rowspan') / 2; j += 0.5) {
                        if ($('.timeslot[data-hour="' + (hour + j) + '"][data-day="' + day + '"][data-index="' + (index + i) + '"]').length) continue;
                        var last = $('.timeslot[data-hour="' + (hour + j) + '"][data-day="' + day + '"]:last');
                        last.after(last.clone().show().removeAttr('rowspan').removeAttr('colspan').attr('data-index', index + i).empty());
                    }
                }
            }
        });

        return Calendar;
    },
    removeFromGrid    : function (courseName) {
        var checkDayNIndex = [];

        // Delete the course from grid array
        $.each(Calendar.courseGrids, function (i, v) {
            $.each(v, function (j, h) {
                $.each(h, function (k, n) {
                    if (n.toString().indexOf(courseName) !== -1) {
                        Calendar.courseGrids[i][j][k] = 0;
                        checkDayNIndex.push([j, k]);
                    }
                });
            });
        });

        // Uniquify the array to reduce multiple checking
        checkDayNIndex = _.uniq(checkDayNIndex, function (item) {
            return item[0] + ' ' + item[1];
        });


        // UI update
        Calendar.columnSeparate();
        $('.lesson[data-name="' + courseName + '"]').remove();
        $.each(checkDayNIndex, function (i, v) {
            var checkElement = $('.timeslot[data-day="' + Calendar.weekdays[v[0]] + '"][data-index="' + v[1] + '"]');
            console.log(checkElement.length + '_' + checkElement.filter(':empty').length + '_' + (checkElement.length > 0 && checkElement.length === checkElement.filter(':empty').length) + '_' + '.timeslot[data-day="' + Calendar.weekdays[v[0]] + '"][data-index="' + v[1] + '"]');
            if (checkElement.length > 0 && checkElement.length === checkElement.filter(':empty').length) {
                var dayCell = $('.table.table-striped th.col-sm-2:nth(' + v[0] + ')');
                checkElement.remove();
                if (dayCell.attr('colspan') - 1 > 1) dayCell.attr('colspan', dayCell.attr('colspan') - 1);
            }
        });
        Calendar.columnMerge().togglePlaceholders();

    },
    togglePlaceholders: function () {

        $.each(Calendar.weekdays, function (i, v) {
            var timeslots    = $('.timeslot[data-day="' + v + '"]');
            var placeHolders = timeslots.filter('[data-index="-1"]');
            var dayCell      = $('.table.table-striped th.col-sm-2:nth(' + i + ')');
            var isEqual      = placeHolders.length === timeslots.length;
            var nicht        = timeslots.filter('[data-hour="8"][data-index!="-1"]');
            var colspan      = 0;
            nicht.each(function () {
                colspan += parseInt($(this).attr('colspan')) || 1;
            });

            if (isEqual) {
                placeHolders.show();
            } else {
                placeHolders.hide();
                dayCell.attr('colspan', colspan);
            }
        });
        return Calendar;
    },
    fillArray         : function (array, fillWith, hour, day, blockNum, currentIndex) {
        // Find the left most possible space and fill in the value
        // For example, if we need to fill up 2 blocks with value v
        // from vertical index 2 then the transition will be like:
        // var a = [[[], [0     , 0, 0], [], [], []],
        //          [[], [1     , 0, 0], [], [], []],
        //          [[], [0 -> v, 2, 0], [], [], []],
        //          [[], [0 -> v, 2, 3], [], [], []]];
        if ('undefined' === typeof array[hour][day][currentIndex] || !array[hour][day].length) {
            $.each(array, function (i) {
                array[i][day].push(i < hour || i >= hour + blockNum ? 0 : fillWith);
            });
        } else {
            var counter = 1;
            $.each(array, function (i, row) {
                if (i <= hour) return;
                if (i >= hour + blockNum) return false;
                counter = !row[day][currentIndex] ? counter + 1 : 0;
            });
            if (counter < blockNum) return Calendar.fillArray(array, fillWith, hour, day, blockNum, currentIndex + 1);
            for (var j = 0; j < blockNum; j++)
                array[hour + j][day][currentIndex] = fillWith;
        }
        return [currentIndex, array];
    }
};

// Copied from w3c
var Cookie = {
    set: function (cname, cvalue, exdays) {
        var d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        var expires     = 'expires=' + d.toUTCString();
        document.cookie = cname + '=' + cvalue + '; ' + expires;
    },
    get: function (cname) {
        var name = cname + '=';
        var ca   = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1);
            if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
        }
        return '';
    }
};

var Course = {
    courses   : [],
    tutorials : {},
    get       : function () {
        var courseName = $("#course-name").val().split('-')[0].toUpperCase().trim();
        if (courseName && Course.courses.indexOf(courseName) === -1) {
            $("#add-course").html("Adding...");
            $("#course-name").val("");
            Course.add(courseName);
        }
        return Course;
    },
    add       : function (courseName, isRecovering) {
        var data = timetableData[courseName];
        recover  = 'undefined' !== typeof isRecovering;

        if (Course.courses.length >= 6 || !data) {
            $("#add-course").html(!data ? 'Course not found!' : 'Too many courses!');
            setTimeout(function () {
                $("#add-course").html("Add");
            }, 2000);
        } else {
            $("#add-course").html("Add");
            _(data).each(Calendar.putLessonGroup);
            Course.courses.push(courseName);

            // add course style class.
            var courseStyleNum = Math.abs(courseName.split("").reduce(function (a, b) {
                    a = ((a << 5) - a) + b.charCodeAt(0);
                    return a & a
                }, 0)) % 6;
            $("[data-name=" + courseName + "]").addClass("lesson-style-" + courseStyleNum);

            Course.display().save();
        }

        return Course;
    },
    remove    : function (courseName) {
        Course.courses = _(Course.courses).without(courseName);

        // Delete all related tutorials
        $.each(Course.tutorials, function (index) {
            if (index.indexOf(courseName) !== -1) delete Course.tutorials[index];
        });

        Calendar.removeFromGrid(courseName);
        Course.display().save();

        return Course;
    },
    display   : function () {
        var displayElement = $('#chosenCourses');
        if (Course.courses.length <= 0) {
            displayElement.html('None.');
            return Course;
        }

        var html = '';
        $.each(Course.courses, function (index, courseName) {
            html += (index === 0 ? '' : ', ') + courseName + ' <a href="javascript:void(0)" onclick="Course.remove(\'' + courseName + '\')">(delete)</a>';
        });
        displayElement.empty().append(html);

        return Course;
    },
    recover   : function () {
        var savedCourses = getSavedData('courses');
        var temp         = getSavedData('tutorials');
        Course.tutorials = temp ? JSON.parse(temp) : {};
        if (savedCourses) {
            Calendar.columnSeparate();
            $.each(JSON.parse(savedCourses), function (i, courseName) {
                Course.add(courseName, true);
            });
            Calendar.columnMerge().togglePlaceholders();
        }
        Course.display();
        return Course;
    },
    save      : function () {
        if (hasLocalStorage) {
            localStorage.setItem('courses', JSON.stringify(Course.courses));
            localStorage.setItem('tutorials', JSON.stringify(Course.tutorials));
        } else {
            Cookie.set('courses', JSON.stringify(Course.courses));
            Cookie.set('tutorials', JSON.stringify(Course.tutorials));
        }
        return Course;
    },
    clear     : function (e) {
        ('undefined' !== typeof e) && e.preventDefault();
        Course.courses   = [];
        Course.tutorials = {};
        Course.display().save();
        $("#cal-container").html(Calendar.html);
        return Course;
    },
    processRaw: function (rawData) {
        $.each(rawData[3], function (i, course) {
            rawData[3][i].fullName = rawData[0][course.nid];
            rawData[3][i].info     = rawData[1][course.iid];
            rawData[3][i].location = rawData[2][course.lid];
            delete rawData[3][i].nid;
            delete rawData[3][i].iid;
            delete rawData[3][i].lid;
        });
        rawLessons = rawData[3];
    }
};

var loadJSON = {
    status      : function (succeed, isLoading) {
        var element = $('#load');
        succeed ? element.removeClass('text-warning').html('Loaded!') : element.addClass('text-warning').html(isLoading ? 'Loading..' : 'Not a valid JSON file!');
        setTimeout(function () {
            element.html("Load data from .json");
        }, 2000);
        return succeed;
    },
    eventHandler: function (e) {
        var reader         = new FileReader();
        reader.onloadstart = function () {
            loadJSON.status(0, 1);
        };
        reader.onload      = function (e) {
            try {
                Course.processRaw($.parseJSON(e.target.result));
            } catch (err) {
                rawLessons = [];
            } finally {
                if (loadJSON.status(!!rawLessons.length)) {
                    $('#clear-courses').click();
                    timetableData = rearrangeLessons(rawLessons);
                    Course.recover();
                }
            }
        };
        reader.readAsText(e.target.files[0]);
    }
};

var Tools = {
    pad    : function (n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    },
    hourify: function (num) {
        var parts = num.toString().split('.');
        return Tools.pad(parts[0], 2) + (parts[1] === '5' ? '30' : '00');
    }
};

var getSavedData = function (name) {
    return hasLocalStorage ? localStorage.getItem(name) : Cookie.get(name);
};

$(function () {

    Calendar.initialize();

    // https://rawgit.com/samyex6/anutimetable/master
    $.get('./data/timetable-test.json', {}, function (data) {
        Course.processRaw(data);
        timetableData = rearrangeLessons(rawLessons);
        Course.recover();
    }).fail(function () {
        $('#load').removeClass('hide');
        $('#chosenCourses').html('Unable to load data from source, please try to refresh or manually load pre-fetched JSON from ./data folder.');
    });

    $("#cal-container").append(Calendar.html);

    document.onkeydown = function (e) {
        if (e.which == 13) {
            event.preventDefault();
            Course.get();
        }
    };

    $("#download").on("click", function (event) {

        var calString     = $("#cal-header").text();
        var eventTemplate = _.template($("#event-template").html());

        _(rawLessons).each(function (lesson) {
            if (Course.courses.indexOf(lesson.name) !== -1) {
                var day = Calendar.weekdays.indexOf(lesson.day);
                calString += eventTemplate({
                    padded_hour    : Tools.hourify(lesson.start),
                    padded_end_hour: Tools.hourify(lesson.start + lesson.dur),
                    first_day      : 15 + day,
                    day            : lesson.day,
                    description    : lesson.info,
                    location       : lesson.location,
                    course         : lesson.name + ' ' + lesson.info,
                    holiday1       : (6 + day < 10) ? "0" + (6 + day) : (6 + day),
                    holiday2       : 13 + day
                });
            }
        });

        calString += "\nEND:VCALENDAR";
        download(calString, "anu_s1_timetable.ics", "text/plain");
    });

    $('#add-course').on('click', Course.get);
    $('#clear-courses').on('click', Course.clear);
    $('#load').on('click', $('#file').change(loadJSON.eventHandler).click);

    $('#course-name').typeahead({
        highlight: true,
        hint     : false
    }, {
        source: function (query, process) {
            var matchIndexes = [], matches = [];

            // Building the array matchIndexes which stores query's appearance position
            // in the course name, also fills the array matches for temporary ease of use.
            query = query.trim().toLowerCase();
            $.each(rawLessons, function (i, course) {
                var matchIndex     = course.fullName.toLowerCase().indexOf(query),
                    simplifiedName = course.fullName.replace(/_[a-zA-Z][0-9]/, ' -');
                if (course.fullName && matchIndex !== -1 && $.inArray(simplifiedName, matches) === -1) {
                    matchIndexes.push({
                        name      : simplifiedName,
                        matchIndex: matchIndex
                    });
                    matches.push(simplifiedName);
                }
            });

            // Sort them depends on the appeared position and name in ascending order
            matchIndexes.sort(function (a, b) {
                return a.matchIndex - b.matchIndex + a.name.localeCompare(b.name);
            });

            // Builds the final result.
            matches = [];
            $.each(matchIndexes, function (i, course) {
                matches.push(course.name);
            });

            process(matches);
        }
    });

});
