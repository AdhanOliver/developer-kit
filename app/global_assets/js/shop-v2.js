var Checkout = {};

(function ($) {

    Checkout = function (options) {
        this.defaultOptions = {
            zonesMap: [],
            addresses: [],
            defaultAddress: false,
            installments: 12,
            currency_symbol: '$',
            total: 0,
        };
        this.options = $.extend({}, this.defaultOptions, options);

        this.$email = $('#a_email');
        this.$btnSearchAddress = $('.btn-search-address');
        this.$zip = $('#zip_code');
        this.$shippingMethodRow = '.shippingwrap td, .shippingwrap input';
        this.$btnOpenLogin = $('.btn-open-login');

        if (this.$email.length > 0) {
            this.$loginModal = $('#login_modal');
            this.$email.on('focusout', $.proxy(this.checkEmail, this));
            if (this.$email.val().length === 0) {
                this.$email.val(' ');
                this.$email.click(function(){ $(this).val(''); });
            }
        }

        this.maskFields();

        this.$btnSearchAddress.on('click', $.proxy(this.doSearchAddress, this));

        $(document).on('click', this.$shippingMethodRow, $.proxy(this.setShipping, this));

        this.$btnOpenLogin.on('click', $.proxy(this.openLogin, this));
        this.$zip.delayKeyup($.proxy(this.searchAddress, this, true, true), 1000);

        if (this.options.defaultAddress) {
            this.populateAddress(this.options.defaultAddress);
        }else{
            this.searchAddress(false, true);
        }

        this.updateCartCallback({total: this.options.total});

        $('#person_fields_btn, #company_fields_btn').click(function(){

            if($('#company_fields').hasClass('hide')){
                $('#person_fields_btn, #company_fields').removeClass('hide');
                $('#company_fields_btn, #person_fields').addClass('hide');
            } else{
                $('#person_fields_btn, #company_fields').addClass('hide');
                $('#company_fields_btn, #person_fields').removeClass('hide');
            }

        });

        var has_errors = false;

        var validationOptions = {
          onError: function(errors){
            has_errors = true;
          },
          onValid: function(){
            has_errors = false;
          }
        };
        
        $('#payment_tabs a.payment-method-nav').each(function(){
            var $this = $(this);
            $this.click(function (e){
                e.preventDefault();
                $this.tab('show');
                var id = $('#payment_tabs div.payment-method.active').attr('id');
                var method = id.split('-')[1];
                $('input[name=module]').val(method);
            });
        });

        $('#onepage_checkoutform').submit(function(e){
            $('#onepage_checkoutform').tinyValidation(validationOptions);
            if(has_errors){
                e.preventDefault();
                alert('Por favor, preencha todos os campos com * antes de prosseguir.');
                return false;
            }else{
                $button = $(this).find('button[type=submit]');
                $button.blur();
                $button.addClass('disabled');
                $button.html('Carregando...');
                return true;
            }
        });
    };

    Checkout.prototype = {
        constructor: Checkout,
        money: function(money) {
            money = parseFloat(money);
            money = money.toFixed(2).replace('.', ',');
            return this.options.currency_symbol + ' ' + money;
        },
        openLogin: function(e) {
            e.preventDefault();
            $('#login_modal').modal('show');
        },
        populateAddress: function(address_id) {
            if(address_id === '' || this.options.addresses.length === 0 || typeof this.options.addresses[address_id] == 'undefined')
            {
                return;
            }
            $('input[name=address_id]').val(address_id);

            $.each(this.options.addresses[address_id], function(key, value){
                if (key != 'cnpj') {
                    $('.address[name='+key+']').val(value);
                }
                if(key=='zone_id')
                {
                    zone_id = value;
                    $('#zone_id').val(zone_id);
                    
                }
            });

            this.maskFields();
            this.searchAddress(false, false);
        },
        maskFields: function() {
            $('#phone').mask_brazilian_phone();
            $('#zip_code').mask("99999-999");
            $('#zip_code_val').mask("99999-999");
            $('#a_cnpj').mask('99.999.999/9999-99');
            $('#a_cpf').mask('999.999.999-99');
            $('#a_birthday').mask('99/99/9999');
        },
        updateCart: function(method, e) {
            var that = this;
            $.post(site_url.base + 'checkout/set_shipping_method', {shipping_method: method, zip: $('#zip_code').val()}, function(data){
                $('.shipping_cost').html('<span class="total">Total: '+that.money(data.total)+'</span>');
                if (data.shipping_cost > 0) {
                    $('.shipping_cost').append(' <span class="shipping">('+that.money(data.subtotal)+' + Frete: '+that.money(data.shipping_cost)+')</span>');
                }
                that.updateCartCallback(data);
            }, 'json');
        },
        updateCartCallback: function(data) {
            var that = this;
            $updateTriggers = $('[data-update=cart]');
            $updateTriggers.each(function(){
                eval($(this).data('calc') + '({installments: '+that.options.installments+', total: '+data.total+'});');
            });
        },
        setShipping: function(e) {
            e.stopPropagation();
            $check = $(e.target).closest('tr').find('input');
            if(!$check.attr('checked') || $(e.target).is('input'))
            {
                $check.attr('checked', true);
                this.updateCart($check.val());
            }
        },
        doSearchAddress: function(e) {
            e.preventDefault();
            this.searchAddress(true, true);
        },
        searchAddress: function(focus, update_address, event) {
            var value = this.$zip.val();

            if (value.length==9 && value.indexOf('_') == -1) {
                $('#shipping_table').html('<tr><td><div class="loading"><i class="icon-refresh"></i> Calculando o frete</div></td></tr>');
                var zip = value.replace("-", "");

                $('.btn-search-address').addClass('disabled');
                $('.btn-search-address').text('Buscando...');

                var that = this;

                $.getJSON(site_url.base + 'shipping/busca_cep',{zip: zip}, function(data) {
                    $('.btn-search-address').removeClass('disabled');
                    $('.btn-search-address').text('Buscar endereço');

                    if(data["resultado"] == "1" && update_address){

                        $("input[name=district]").val(unescape(data["bairro"]));
                        $("input[name=city]").val(unescape(data["cidade"]));
                        $("select[name=zone_id]").val(unescape( that.options.zonesMap[data["uf"]] ));
                        $("input[name=address1]").val(unescape(data["logradouro"]));
                        if (focus) {
                            $("input[name=anumber]").focus();
                        }
                    }
                    $.post(site_url.base + 'shipping/get_frete', {zip: zip, data: data}, function(fdata) {
                        $('#shipping_table').html(fdata);
                        if ($('#shipping_table input').length == 1) {
                            $('#shipping_table input').prop('checked', true);
                        }
                        if ($('#shipping_table input:checked').length > 0) {
                            that.updateCart($('#shipping_table input:checked').val());
                        }
                    });
                });
            }
        },
        checkEmail: function() {
            var email = this.$email.val();
            if (email.length > 5) {
                var that = this;
                $.ajax({
                    url: site_url.base + 'cart/check_email',
                    type: 'GET',
                    data: {'email': email},
                    dataType: 'json',
                    success: function(data){
                        if (data.result) {
                            that.$loginModal.modal('show');
                            that.$loginModal.find('.alert-account-exists').removeClass('hide');
                            that.$loginModal.find('input[name=email]').val(email);
                        }
                    }
                });
            }
        },
    };

}(jQuery));


$.fn.delayKeyup = function(callback, ms){
    var timer = 0;
    var el = $(this);
    $(this).keyup(function(){
    clearTimeout (timer);
    timer = setTimeout(function(){
        callback(el);
        }, ms);
    });
    return $(this);
};

function toggle_shipping(key){
    
}