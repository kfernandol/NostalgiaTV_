using ApplicationCore.DTOs.Episode;
using FluentValidation;

namespace WebApi.Validators
{
    public class EpisodeRequestValidator : AbstractValidator<EpisodeRequest>
    {
        public EpisodeRequestValidator()
        {
            RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
            RuleFor(x => x.SeriesId).GreaterThan(0);
            RuleFor(x => x.EpisodeTypeId).GreaterThan(0);
            RuleFor(x => x.Season).GreaterThanOrEqualTo(0);
        }
    }
}
