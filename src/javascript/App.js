Ext.define('packed-circle-diagram', {    extend: 'Rally.app.App',    componentCls: 'app',    itemId: 'rallyApp',    portfolioSizingField:  function() { return 'LeafStoryPlanEstimateTotal'; },    portfolioChildField: function() { return 'UserStories'},    storySizingField: function() { return 'PlanEstimate'},    storyChildField: function() { return 'Tasks'},  //What to do about stories and defects?!?!    taskSizingField: function() { return 'Estimate'},    //Might want to add a selector to choose 'ToDo' instead based on whether the field is a 'double'    items: [        {            xtype: 'container',            itemId: 'rootSurface',            margin: '10 10 10 10',            layout: 'auto',            title: 'Loading...',            autoEl: {                tag: 'svg'            },            listeners: {                afterrender:  function() {  gApp = this.up('#rallyApp'); gApp._onElementValid(this);},                resize: function() {  gApp = this.up('#rallyApp'); gApp._onElementResize(this);}            },            visible: false        }    ],    launch: function() {    },    _onElementResize: function(rs) {        this._setSVGSize(rs);        //TODO: Set zoom    },    //Set the SVG area to the surface we have provided    _setSVGSize: function(surface) {        var svg = d3.select('svg');        svg.attr('width', surface.getEl().dom.clientWidth);        svg.attr('height',surface.getEl().dom.clientHeight);    },    //Entry point after creation of render box    _onElementValid: function(rs) {        //Create an empty list of svg items (global)        nodeList = null;        //Add any useful selectors into this container ( which is inserted before the rootSurface )        //Choose a point when all are 'ready' to jump off into the rest of the app        this.insert (0,{            xtype: 'container',            items: [                {                    xtype:  'rallyportfolioitemtypecombobox',                    itemId: 'piType',                    margin: '5 0 5 20',                    listeners: {                        select: function() { gApp._enterMainApp();}    //Jump off here to app                    }                }            ]        });    },    //Continuation point after PI type selector ready/changed    _enterMainApp: function() {        //Clear the decks as we are dealing with a new type        if (nodeList) nodeList.remove();        //Make surface the size available in the viewport (minus the selectors and margins)        var rs = this.down('#rootSurface');        rs.getEl().setWidth(this.getSize().width - 20);        rs.getEl().setHeight((this.getSize().height - rs.getBox().top) - 15);        var svg = d3.select('svg');        svg.attr('class', 'root-surface');        //Set the svg area to the surface        this._setSVGSize(rs);        //Define a global for the edge of view so circles don't hit the edge of the surface (or parent circle) - looks better!//        circleMargin = 0.02;        circleMargin = 0;        //Create a color scheme        this._createColourScheme();        //Define a global for the current perspective        view = null;        //Define the size of the whole thing. We refer to this when zoomin        rootDiameter = Math.min( svg.attr("width"), svg.attr("height"));    //Set maximum size at start        //Create a grouping to use for all drawn items so we can zoom about at will and set the view to the middle        g = svg.append("g").attr("transform", "translate(" + rootDiameter / 2 + "," + rootDiameter / 2 + ")");        //Define a global  for the last thing clicked        focus = null;        //Create the initial dataset in this form        // var root = { 'name' : 'root', 'children': [ { 'name' : 'child1','size': 200 },{ 'name' : 'child2','children' : [{  etc. etc. }] }]};        var topRoot = { 'name' : 'root', 'children': [ ]};        //Get the piType we are starting with        var piType = gApp.down('#piType');        var piName = piType.getRawValue();         var rootStore = Ext.create('Rally.data.wsapi.Store', {            model: 'portfolioitem/' + piName,            autoLoad: true,            listeners: {                load: function(store, data, success) {                    _.each(data, function(d) {                        var s;                        //Decide what data you want for these things                        topRoot.children.push(gApp._createNodeForArtefact(d));                    });                    //If we had some data, then set up to call _runSVG                    if (topRoot.children.length) {                        //Define root in hierarchy                        var root = d3.hierarchy(topRoot)                              .sum(function(d) { return d.size; })                              .sort(function(a, b) { return b.value - a.value; });                        //Define this as the item of interest                        focus = root;                        //Add all the stuff to SVG                        gApp._runSVG(root, rootDiameter);                        //Add a 'return to the beginning' ability                        svg.on("click", function() { gApp._zoom(root, d3.event); });                        //If any added refresh the 'node' handle                        gApp._updateNodeList();                        //Now get the view to the right place                        gApp._zoomTo([root.x, root.y, root.r * 2 + (circleMargin * rootDiameter)], nodeList);                    }                    //If no data returned, be nice, let the user know!                    else Rally.ui.notify.Notifier.show({message: 'No items found'});                }            },            fetch: ['FormattedID', 'Name', gApp.portfolioSizingField(), 'Children', 'UserStories'],        });    },    _getNodeId: function(d){        return d.data.record? d.data.record.get('FormattedID'): Ext.id();    },    _runSVG: (function(root, diameter) {        // re-find the svg        var svg = d3.select('svg');        var pack = d3.pack()            .size([diameter  * (1 - circleMargin), diameter * ( 1 - circleMargin)])            .padding(2);        var nodes = pack(root).descendants();        var circle = g.selectAll("circle")            .data(nodes, gApp._getNodeId)            .enter().append("circle")            .attr('id', function(d) {  return gApp._getNodeId(d)})            .on("click", function(sn,index,selected) {                var thisNode = this;                var event = d3.event;                event.stopPropagation();                //Now get the children for this artifact and add to the list                record = sn.data.record;                if (record && record.isPortfolioItem()) {                    var storyRoot = { 'name' : record.get('FormattedID'), 'children': [ ]};                    record.getCollection(gApp.portfolioChildField()).load({                            fetch: ['FormattedID', 'Name', gApp.storySizingField(), 'Tasks'],                            callback: function (records, operation, success) {                                _.each(records, function(r) {                                    var s;                                    storyRoot.children.push({'name' : r.get('FormattedID'), 'size' : (s = r.get(gApp.storySizingField()))?s:1, 'record': r});                                });                                storyRoot = d3.hierarchy(storyRoot)                                    .sum(function(d) { return d.size; })                                    .sort(function(a, b) { return b.value - a.value; });                                var usPack = d3.pack()                                    .size([sn.r  * 2 * (1 - circleMargin), sn.r * 2 * ( 1 - circleMargin)])//                                    .radius( function() { return Math.min(thisNode.getBBox().width, thisNode.getBBox().height)/2 })                                    .padding(2);                                var storyPack = usPack(storyRoot).descendants();                                //Update parameters for each new item                                storyPack.forEach( function(d) {                                    //Move the circles to the right location on the screen                                    d.x += (sn.x - sn.r); d.y += (sn.y - sn.r);                                    //Give them a parent                                    d.parent = sn;                                    //Update thier depth                                    d.depth += sn.depth;                                });                                //Give them to the parent                                sn.children = storyPack                                //Add them into the group                                var storyCircle = g.selectAll("circle")                                            .data(storyPack, gApp._getNodeId)                                            .enter().append("circle")                                            .attr("r", function(d) { return d.r ; })                                            .attr("class", function(d) { return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root"; })                                            .style("fill", function(d) { return gApp._getNodeColour(d ); })                                            .style("display", function(d) { return d.parent  ? d.children ? "none" : "inline" : "none"; })                                            .attr('id', function(d) {  return "circle-"+  gApp._getNodeId(d) ;})                                            .on('click', function (sd, index, selected) {                                                var event = d3.event;                                                event.stopPropagation();                                                if (focus !== sd) gApp._zoom(sd, event);                                            });                                storyCircle.merge(storyCircle);                                //Add text labels                                var text = g.selectAll("text")                                    .data(storyPack, gApp._getNodeId)                                    .enter().append("text")                                    .attr("class", "applink")                                    .text(function(d) { return d.data.name; });                                //Update the node list                                gApp._updateNodeList(text);                                if (focus !== sn) gApp._zoom(sn, event);                                //Set text visibility                                gApp._setTextVisibility(text);                            }                        }                    )                }            })                .on("mouseover", function(d,index,selected) {//                    debugger;                    gApp._createToolTip(this);                    return true;                }, this)                .attr("class", function(d) { return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root"; })                .style("fill", function(d) { return gApp._getNodeColour(d); })                .style("display", function(d) { return d.parent ? "inline" : "none"; });        text = g.selectAll("text")            .data(nodes)            .enter().append("text")                .attr("class", "applink")                .text(function(d) { return d.data.name; });        gApp._setTextVisibility(text);        return false;    }),    //We will overlay the title of the artefact for now    _createTipText: function(record) {        return text = record ? record.get('Name') : "Unknown Artefact Type";    },    _createToolTip: function (d) {        if ( !(d.tooltip)) {            d.tooltip = Ext.create( 'Rally.ui.tooltip.ToolTip', {                html: gApp._createTipText(d.__data__.data.record),                target: d,                autoShow: true,                showDelay: 500,                anchor: 'top',                constrainPosition: true            });        }    },    _setTextVisibility: function(labels) {          labels              .style("fill-opacity", function(d) {                    return d.parent === focus ? 1 : 0;                })              .style("display", function(d) {                    return d.parent === focus ? "inline" : "none";                })              ;    },    //Some helper functions specific to the SVG    _zoomTo: function(v, elements) {        //Work out relation to the big picture        var k = rootDiameter / v[2];        //Store the current requested view area        view = v;        //Apply the transformation to the list of things        elements.attr("transform", function(d) {            return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")";        });        //If there are any circles in there, we need to adjust the radius as well.        var circles = elements.filter("circle");        circles.attr("r", function(d) { return d.r * k; });        //When we zoom, check text visibility        var text = g.selectAll("text");        gApp._setTextVisibility(text);      },    _zoom: function(d, event) {        //Highlight that we are now looking at this thing        focus = d;        //Start the animation to the new thing        var transition = d3.transition()            .duration(event && event.altkey?3000:750)            .tween("zoom", function(d) {                var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);//              var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2 + (circleMargin * rootDiameter)]);              return function(t) { gApp._zoomTo(i(t), nodeList); };            });        //Work out whether we need to hide any text        transition.selectAll("text");//          .filter(function(d) { return d.parent === focus })//            .style("fill-opacity", function(d) { return d.parent === focus ? 1 : 0; })//            .on("start", function(d) { if (d.parent === focus) this.style.display = "inline"; })//            .on("end", function(d) { if (d.parent !== focus) this.style.display = "none"; });      },    _createColourScheme: function() {        //Create a colour scheme global//        color = d3.scaleOrdinal(d3.schemeCategarory20b);        color = d3.scaleLinear()            .domain([-1, 5])            .range(["hsl(152,80%,80%)", "hsl(228,30%,40%)"])            .interpolate(d3.interpolateHcl);    },    _createNodeForArtefact: function (d) {            return ({ 'name': d.get('FormattedID'), 'size' : (s = d.get(gApp._getNodeSizingField(d)))>0?s:1, 'record': d});    },    //Decide the colouring of the main circle for this node    //Add children information if required    _getNodeColour: function(d) {        if (!(d.data.record)) return null;        //If we have the field on the record with some stuff in it, use it to colour (for now, just use the depth)        return d.data.record ? d.data.record.get(gApp._getNodeSizingField(d.data.record)) ? color(d.depth) : 'grey' : null;    },    _getNodeSizingField: function ( d) {        //Assume we are at Task level (ignoring Test Sets, etc.,)        var sizingField = gApp.taskSizingField;        if (d.isPortfolioItem()) {            //Only user portfolioitems have the field 'UserStories'.            sizingField = gApp.portfolioSizingField;        }        else if (d.isUserStory()) {            //Only user stories/defects have the field 'Tasks'.            sizingField = gApp.storySizingField;        }        return sizingField();    },    _updateNodeList: function() {            nodeList = g.selectAll("circle,text");  //Create a global for zooming of all things in the picture    }});