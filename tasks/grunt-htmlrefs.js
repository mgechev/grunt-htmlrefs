/*
 * grunt-htmlrefs
 * https://github.com/tactivos/grunt-htmlrefs
 *
 *    Part of this work (the expression at least) is inspired
 *    on what YEOMAN (http://github.com/yeoman) does. However
 *    we chose a simplest path (of replacing/removing only) without
 *    going through the full work of replacing and merging stuff.
 *
 * Copyright (c) 2012 Johnny G. Halife & Mural.ly Dev Team
 */
module.exports = function (grunt) {
    var _ = grunt.util._;

    var path = require('path');

    // start build pattern --> <!-- build:[target] output -->
    var regbuild = /<!--\s*build:(\w+)\s*(.+)\s*-->/;

    // end build pattern -- <!-- endbuild -->
    var regend = /<!--\s*endbuild\s*-->/;

    // stylesheet template
    var stylesheetTemplate = '<link type="text/css" rel="stylesheet" href="<%= dest %>">';

    // inlineCSS template
    var inlineCSSTemplate = '<style><%= dest %></style>';    

    // <script> template
    var scriptTemplate;
    
    grunt.registerMultiTask('htmlrefs', "Replaces (or removes) references to non-optimized scripts or stylesheets on HTML files", function () {
        var params = this.options();
        var includes = (this.data.includes || {});
        var pkg = (grunt.config.get('pkg') || {});
        var files = this.filesSrc;
        var dest = this.files[0].dest;
        var async = (params.async) ? 'async' : '';
    
        scriptTemplate = '<script type="text/javascript" src="<%= dest %>" ' + async + '></script>';

        this.files.forEach(function (filePair) {

            var file = filePair.src.forEach(function (src) {
                var content = grunt.file.read(src);
                var blocks = getBlocks(content);

                // Determine the linefeed from the content
                var lf = /\r\n/g.test(content) ? '\r\n' : '\n';

                blocks.forEach(function (block) {
                    // Determine the indent from the content
                    var raw = block.raw.join(lf);
                    var options = _.extend({}, { pkg: pkg }, block, params);

                    var replacement = htmlrefsTemplate[block.type](options, lf, includes);
                    content = content.replace(raw, replacement);
                });
                grunt.file.write(filePair.dest, content);
            });
        });
    });

    var htmlrefsTemplate = {
            js : function (block) {
                var indent = (block.raw[0].match(/^\s*/) || [])[0];
                return indent + grunt.template.process(scriptTemplate, {data: block});
            },
            css : function (block) {
                var indent = (block.raw[0].match(/^\s*/) || [])[0];
                return indent + grunt.template.process(stylesheetTemplate, {data: block});
            },
            inlinecss : function (block) {
                var indent = (block.raw[0].match(/^\s*/) || [])[0];
                var lines = grunt.file.read(block.dest).replace(/\r\n/g, '\n').split(/\n/).map(function(l) {return indent + l});            
                return indent + grunt.template.process(inlineCSSTemplate, {data: {dest:lines}});
            },                    
            include : function (block, lf, includes) {
                // let's see if we have that include listed
                if(!includes[block.dest]) return '';

                var indent = (block.raw[0].match(/^\s*/) || [])[0];
                var lines = grunt.file.read(includes[block.dest]).replace(/\r\n/g, '\n').split(/\n/).map(function(l) {return indent + l});

                return lines.join(lf);
            },
            remove : function (block) {
                return ''; // removes replaces with nothing
            }
    };

    function getBlocks(body) {
        var lines = body.replace(/\r\n/g, '\n').split(/\n/),
            block = false,
            sections = {},
            last;

        lines.forEach(function (l) {
            var build = l.match(regbuild),
                endbuild = regend.test(l);

            if(build) {
                block = true;
                // create a random key to support multiple removes
                var key = build[2].length > 1 ? build[2] : (Math.random(1,2) * Math.random(0, 1));
                sections[[build[1], key.toString().trim()].join(':')] = last = [];
            }

            // switch back block flag when endbuild
            if(block && endbuild) {
                last.push(l);
                block = false;
            }

            if(block && last) {
                last.push(l);
            }
        });

        var blocks = [];

        for(var s in sections) {
            blocks.push(fromSectionToBlock(s, sections[s]));
        }

        return blocks;
    }

    function fromSectionToBlock(key, section) {
        var chunks = key.split(':');

        return {
            type: chunks[0],
            dest: chunks[1],
            raw: section
        };
    }
};
