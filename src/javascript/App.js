Ext.define('packed-circle-diagram', {    extend: 'Rally.app.App',    componentCls: 'app',    itemId: 'rallyApp',    portfolioSizingField: 'LeafStoryPlanEstimateTotal',    items: [        {            xtype: 'container',            itemId: 'rootSurface',            margin: '10 10 10 10',            layout: 'auto',            title: 'Loading...',            autoEl: {                tag: 'svg'            },            listeners: {                afterrender:  function() {  gApp = this.up('#rallyApp'); gApp._onElementValid(this);},                resize: function() {  gApp = this.up('#rallyApp'); gApp._onElementResize(this);}            },            visible: false        }    ],    launch: function() {    },    _onElementResize: function(rootSurface) {        this._setSVGSize(rootSurface);        //TODO: Set zoom    },    //Set the SVG area to the surface we have provided    _setSVGSize: function(surface) {        var svg = d3.select('svg');        svg.attr('width', surface.getEl().dom.clientWidth);        svg.attr('height',surface.getEl().dom.clientHeight);    },    //Entry point after creation of render box    _onElementValid: function(rs) {        //Create an empty list of svg items (global)        nodeList = null;        //Add any useful selectors into this container ( which is inserted before the rootSurface )        //Choose a point when all are 'ready' to jump off into the rest of the app        this.insert (0,{            xtype: 'container',            items: [                {                    xtype:  'rallyportfolioitemtypecombobox',                    itemId: 'piType',                    margin: '5 0 5 20',                    listeners: {                        select: function() { gApp._enterMainApp(rs);}    //Jump off here to app                    }                }            ]        });    },    //Continuation point after PI type selector ready/changed    _enterMainApp: function(rs) {        //Clear the decks as we are dealing with a new type        if (nodeList) nodeList.remove();        //Make surface the size available in the viewport (minus the selectors and margins)//        var rs = this.down('#rootSurface');        rs.getEl().setWidth(this.getSize().width - 20);        rs.getEl().setHeight((this.getSize().height - rs.getBox().top) - 15);        var svg = d3.select('svg');        svg.attr('class', 'root-surface');        //Set the svg area to the surface        this._setSVGSize(rs);        //Define a global for edge of view so circles don't hit the edge of the surface - looks better!        margin = 20;        //Create the dataset in this form        // var root = { 'name' : 'root', 'children': [ { 'name' : 'child1','size': 200 },{ 'name' : 'child2','children' : [{  etc. etc. }] }]};        var topRoot = { 'name' : 'root', 'children': [ ]};        //Get the piType we are starting with        var piType = gApp.down('#piType');        var piName = piType.getRawValue();         var rootStore = Ext.create('Rally.data.wsapi.Store', {            model: 'portfolioitem/' + piName,            autoLoad: true,            listeners: {                load: function(store, data, success) {                    _.each(data, function(d) {                        var s;                        topRoot.children.push({ 'name': d.get('FormattedID'), 'size' : (s = d.get(gApp.portfolioSizingField))?s:1, 'record': d});                    });                    //When ready, call this function                    if (topRoot.children.length)  gApp._runSVG(topRoot);                    else Rally.ui.notify.Notifier.show({message: 'No items found'});                }            },            fetch: ['FormattedID', gApp.portfolioSizingField, 'Children', 'UserStories'],        });    },        _runSVG: (function(newRoot) {        //Some helper fucnctions specific to the SVG        function zoomTo(v, elements) {            var k = diameter / v[2]; view = v;            elements.attr("transform", function(d) {                return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")";            });            var circles = elements.filter("circle");            circles.attr("r", function(d) { return d.r * k; });          };          function zoom(d) {            var focus0 = focus; focus = d;            var transition = d3.transition()                .duration(d3.event.altKey ? 7500 : 750)                .tween("zoom", function(d) {                  var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2 + margin]);                  return function(t) { zoomTo(i(t), nodeList); };                });            transition.selectAll("text")              .filter(function(d) { return d.parent === focus || this.style.display === "inline"; })                .style("fill-opacity", function(d) { return d.parent === focus ? 1 : 0; })                .on("start", function(d) { if (d.parent === focus) this.style.display = "inline"; })                .on("end", function(d) { if (d.parent !== focus) this.style.display = "none"; });          };        //Define global for root.        root = d3.hierarchy(newRoot)              .sum(function(d) { return d.size; })              .sort(function(a, b) { return b.value - a.value; });        //Define a global for item of interest        focus = root;        //Define a global for all the current perspective        view = null;        // re-find the svg        var svg = d3.select('svg');        //Create a grouping to use for all drawn items so we can zoom about at will and set the view to the middle        var diameter = Math.min( svg.attr("width"), svg.attr("height"));    //Set maximum size at start        g = svg.append("g").attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")");        //Create a colour scheme        var color = d3.scaleLinear()            .domain([-1, 5])            .range(["hsl(152,80%,80%)", "hsl(228,30%,40%)"])            .interpolate(d3.interpolateHcl);        var pack = d3.pack()            .size([diameter - margin, diameter - margin])            .padding(2);        var arc = d3.arc({            innerRadius: 0,            outerRadius: function(d) { },            startAngle: 0,            endAngle: 100        });        var nodes = pack(root).descendants();        var circle = g.selectAll("circle")            .data(nodes)            .enter().append("circle")            .on("click", function(lNode,index,selected) {                var thisNode = this;                if (focus !== lNode) zoom(lNode);                d3.event.stopPropagation();                //Now get the children for this artifact and add to the list                record = lNode.data.record;                if (record.get('UserStories')) {                    var storyRoot = { 'name' : record.get('FormattedID'), 'children': [ ]};                    record.getCollection('UserStories').load({                            fetch: ['FormattedID', 'Name', 'PlanEstimate', 'Tasks'],                            callback: function (records, operation, success) {                                _.each(records, function(r) {                                    var s;                                    storyRoot.children.push({'name' : r.get('FormattedID'), 'size' : (s = r.get('PlanEstimate'))?s:1, 'record': r});                                });                                storyRoot = d3.hierarchy(storyRoot)                                    .sum(function(d) { return d.size; })                                    .sort(function(a, b) { return b.value - a.value; });                                var usPack = d3.pack()                                    .size([thisNode.getBBox().x, thisNode.getBBox().y])                                    .radius( function() { return Math.min(thisNode.getBBox().width, thisNode.getBBox().height)/2 })                                    .padding(2);                                var storyPack = usPack(storyRoot).descendants();                                storyCircle = g.selectAll("circle").data(storyPack).enter().append("circle");                                storyCircle.attr("transform", function(d) {                                        return "translate(" + (d.x - thisNode.x)  + "," + (d.y - thisNode.y) + ")";                                });                                storyCircle.attr("r", function(d) { return d.r ; })                                  .attr("class", function(d) { return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root"; })                                  .style("fill", function(d) { debugger; return d.children ? color(d.depth) : null; })                                  .style("display", function(d) { return d.parent === root ? "inline" : "none"; });                                //Update the node list                                gApp._updateNodeList();                            }                        }                    );                }            })                .attr("class", function(d) { return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root"; })                .style("fill", function(d) {                    return d.data.record ? d.data.record.get(gApp.portfolioSizingField) ? color(d.depth) : 'grey' : null;                })                .style("display", function(d) { return d.parent === root ? "inline" : "none"; });          var text = g.selectAll("text")            .data(nodes)            .enter().append("text")              .attr("class", "applink")              .style("fill-opacity", function(d) { return d.parent === root ? 1 : 0; })              .style("display", function(d) { return d.parent === root ? "inline" : "none"; })              .text(function(d) { return d.data.name; });        circle.attr('id', function(d) {  return "circle-"+  (d.data.record ? d.data.record.get('FormattedID') : "unknown");});;        //Add a 'return to the beginning; ability        svg.on("click", function() { zoom(root); });        //If any added refresh the 'node' handle        gApp._updateNodeList();        //Start at the beginning        focus = root;         zoomTo([root.x, root.y, root.r * 2 + margin], nodeList);        return false;    }),    _updateNodeList: function() {            nodeList = g.selectAll("circle,text");  //Create a global for zooming of all things in the picture    }});